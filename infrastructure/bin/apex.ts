#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApexStack } from "../lib/apex-stack";

const app = new cdk.App();

new ApexStack(app, "ApexStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
  description: "Apex streaming network — core infrastructure",
});

app.synth();
