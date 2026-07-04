import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ses from "aws-cdk-lib/aws-ses";

export class ApexStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const account = cdk.Stack.of(this).account;
    const sshCidr =
      (this.node.tryGetContext("apex:allowedSshCidr") as string) ??
      "0.0.0.0/32";
    const domainName =
      (this.node.tryGetContext("apex:domainName") as string) ?? "apex.tv";
    const cdnDomain =
      (this.node.tryGetContext("apex:cdnDomain") as string) ?? "cdn.apex.tv";

    // ─────────────────────────── VPC ───────────────────────────
    const vpc = new ec2.Vpc(this, "ApexVpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // ─────────────────────── Security Groups ───────────────────────
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "ALB — public 443/80",
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP redirect");

    const apiSg = new ec2.SecurityGroup(this, "ApiSg", {
      vpc,
      description: "API EC2 — from ALB + SSH from admin IP",
      allowAllOutbound: true,
    });
    apiSg.addIngressRule(albSg, ec2.Port.tcp(3000), "App from ALB");
    apiSg.addIngressRule(albSg, ec2.Port.tcp(80), "HTTP from ALB");
    apiSg.addIngressRule(albSg, ec2.Port.tcp(443), "HTTPS from ALB");
    apiSg.addIngressRule(ec2.Peer.ipv4(sshCidr), ec2.Port.tcp(22), "SSH admin");

    const streamSg = new ec2.SecurityGroup(this, "StreamSg", {
      vpc,
      description: "Streaming EC2 — RTMP 1935 + HLS 80/443",
      allowAllOutbound: true,
    });
    streamSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(1935), "RTMP ingest");
    streamSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HLS output");
    streamSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HLS TLS");
    streamSg.addIngressRule(ec2.Peer.ipv4(sshCidr), ec2.Port.tcp(22), "SSH admin");

    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc,
      description: "RDS — 5432 from API only",
      allowAllOutbound: true,
    });
    dbSg.addIngressRule(apiSg, ec2.Port.tcp(5432), "Postgres from API");

    const cacheSg = new ec2.SecurityGroup(this, "CacheSg", {
      vpc,
      description: "ElastiCache — 6379 from API only",
      allowAllOutbound: true,
    });
    cacheSg.addIngressRule(apiSg, ec2.Port.tcp(6379), "Valkey from API");

    // ─────────────────────── S3 Buckets ───────────────────────
    const videosBucket = new s3.Bucket(this, "VideosBucket", {
      bucketName: `apex-videos-${account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: "intelligent-tiering-after-90d",
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      bucketName: `apex-uploads-${account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        { id: "expire-24h", expiration: cdk.Duration.days(1) },
        { abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const assetsBucket = new s3.Bucket(this, "AssetsBucket", {
      bucketName: `apex-assets-${account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─────────────────── ACM cert + Route53 zone ───────────────────
    const hostedZone = new route53.PublicHostedZone(this, "ApexZone", {
      zoneName: domainName,
    });

    const cdnCert = new acm.Certificate(this, "CdnCert", {
      domainName: cdnDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // ─────────────────────── CloudFront ───────────────────────
    const noCachePolicy = new cloudfront.CachePolicy(this, "HlsNoCache", {
      cachePolicyName: "apex-hls-nocache",
      defaultTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
    });

    const vodCachePolicy = new cloudfront.CachePolicy(this, "VodCache", {
      cachePolicyName: "apex-vod-cache",
      defaultTtl: cdk.Duration.days(7),
      minTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(30),
    });

    const videoOrigin =
      origins.S3BucketOrigin.withOriginAccessControl(videosBucket);

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultBehavior: {
        origin: videoOrigin,
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/hls/*": {
          origin: videoOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: noCachePolicy,
        },
        "/vod/*": {
          origin: videoOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: vodCachePolicy,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames: [cdnDomain],
      certificate: cdnCert,
      defaultRootObject: "",
    });

    new route53.CnameRecord(this, "CdnDns", {
      zone: hostedZone,
      recordName: cdnDomain,
      domainName: distribution.distributionDomainName,
    });

    // ─────────────────── Secrets Manager ───────────────────
    const rdsSecret = new secretsmanager.Secret(this, "RdsCredentials", {
      secretName: "apex/rds/credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "apex_admin" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    const manualSecretNames = [
      "apex/stripe/secret-key",
      "apex/stripe/webhook-secret",
      "apex/stripe/connect-client-id",
      "apex/google/oauth-client-id",
      "apex/google/oauth-client-secret",
      "apex/jwt/access-secret",
      "apex/jwt/refresh-secret",
      "apex/youtube/api-key",
      "apex/ses/smtp-credentials",
    ];
    const manualSecrets = manualSecretNames.map(
      (name, i) =>
        new secretsmanager.Secret(this, `Secret${i}`, {
          secretName: name,
          description: "Fill manually after deploy",
        })
    );

    // ─────────────────────── RDS PostgreSQL ───────────────────────
    const db = new rds.DatabaseInstance(this, "ApexDb", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(rdsSecret),
      multiAz: false,
      allocatedStorage: 100,
      maxAllocatedStorage: 500,
      storageType: rds.StorageType.GP3,
      backupRetention: cdk.Duration.days(7),
      databaseName: "apex",
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: true,
    });

    // ─────────────────── ElastiCache Valkey ───────────────────
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      "CacheSubnets",
      {
        description: "Apex Valkey subnet group",
        subnetIds: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        cacheSubnetGroupName: "apex-valkey-subnets",
      }
    );

    const valkey = new elasticache.CfnCacheCluster(this, "Valkey", {
      engine: "valkey",
      cacheNodeType: "cache.t3.micro",
      numCacheNodes: 1,
      clusterName: "apex-valkey",
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      vpcSecurityGroupIds: [cacheSg.securityGroupId],
      port: 6379,
    });
    valkey.addDependency(cacheSubnetGroup);

    // ─────────────────── IAM role for EC2 API ───────────────────
    const apiRole = new iam.Role(this, "ApiInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });
    videosBucket.grantReadWrite(apiRole);
    uploadsBucket.grantReadWrite(apiRole);
    assetsBucket.grantReadWrite(apiRole);
    rdsSecret.grantRead(apiRole);
    manualSecrets.forEach((s) => s.grantRead(apiRole));
    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      })
    );
    apiRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "rekognition:DetectModerationLabels",
          "rekognition:DetectLabels",
        ],
        resources: ["*"],
      })
    );

    // ─────────────────── EC2 API Server ───────────────────
    const apiUserData = ec2.UserData.forLinux();
    apiUserData.addCommands(
      "set -euxo pipefail",
      "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -",
      "dnf install -y nodejs git",
      "npm install -g pm2 pnpm",
      "echo 'Apex API host provisioned'"
    );

    const apiInstance = new ec2.Instance(this, "ApiServer", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: apiSg,
      role: apiRole,
      userData: apiUserData,
    });

    // ─────────────────── EC2 Streaming Server ───────────────────
    const streamRole = new iam.Role(this, "StreamInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });
    videosBucket.grantReadWrite(streamRole);

    const streamUserData = ec2.UserData.forLinux();
    streamUserData.addCommands(
      "set -euxo pipefail",
      "apt-get update -y",
      "apt-get install -y libnginx-mod-rtmp nginx ffmpeg git curl build-essential",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
      "apt-get install -y nodejs",
      "npm install -g pm2",
      "mkdir -p /var/www/hls",
      "echo 'Apex streaming host provisioned'"
    );

    const streamInstance = new ec2.Instance(this, "StreamServer", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.C5,
        ec2.InstanceSize.XLARGE
      ),
      machineImage: ec2.MachineImage.genericLinux({
        // Ubuntu 22.04 LTS amd64 — replace per-region AMI as needed.
        "us-east-1": "ami-0e001c9271cf7f3b9",
      }),
      securityGroup: streamSg,
      role: streamRole,
      userData: streamUserData,
    });

    // ─────────────────────── ALB ───────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    const albCert = new acm.Certificate(this, "AlbCert", {
      domainName: `api.${domainName}`,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const httpsListener = alb.addListener("Https", {
      port: 443,
      certificates: [albCert],
      protocol: elbv2.ApplicationProtocol.HTTPS,
    });

    httpsListener.addTargets("ApiTarget", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [new targets.InstanceTarget(apiInstance, 3000)],
      healthCheck: {
        path: "/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
      },
    });

    alb.addListener("HttpRedirect", {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    new route53.ARecord(this, "ApiDns", {
      zone: hostedZone,
      recordName: `api.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.LoadBalancerTarget(alb)
      ),
    });

    // ─────────────────────── SES domain ───────────────────────
    new ses.EmailIdentity(this, "SesDomain", {
      identity: ses.Identity.publicHostedZone(hostedZone),
    });

    // ─────────────────────── Outputs ───────────────────────
    new cdk.CfnOutput(this, "VpcId", { value: vpc.vpcId });
    new cdk.CfnOutput(this, "AlbDnsName", { value: alb.loadBalancerDnsName });
    new cdk.CfnOutput(this, "CloudFrontDomain", {
      value: distribution.distributionDomainName,
    });
    new cdk.CfnOutput(this, "CdnCustomDomain", { value: cdnDomain });
    new cdk.CfnOutput(this, "RdsEndpoint", {
      value: db.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, "ValkeyEndpoint", {
      value: valkey.attrRedisEndpointAddress,
    });
    new cdk.CfnOutput(this, "VideosBucketName", {
      value: videosBucket.bucketName,
    });
    new cdk.CfnOutput(this, "UploadsBucketName", {
      value: uploadsBucket.bucketName,
    });
    new cdk.CfnOutput(this, "AssetsBucketName", {
      value: assetsBucket.bucketName,
    });
    new cdk.CfnOutput(this, "ApiInstanceId", {
      value: apiInstance.instanceId,
    });
    new cdk.CfnOutput(this, "StreamInstancePublicIp", {
      value: streamInstance.instancePublicIp,
    });
    new cdk.CfnOutput(this, "NameServers", {
      value: cdk.Fn.join(",", hostedZone.hostedZoneNameServers ?? []),
      description: "Point your registrar at these NS records",
    });
  }
}
