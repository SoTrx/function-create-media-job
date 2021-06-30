import "reflect-metadata";
import { env } from "process";
import {
  AzureLoginProvider,
  IAzLoginCredentials,
  IStorageAccountOptions,
} from "../../@types/media-client";
import container from "../../container";
import TYPES from "../../types";
import { AzureMediaClient } from "./azure-media-client.service";
import { join } from "path";
import { readFileSync } from "fs";
import { AzureMediaServices } from "@azure/arm-mediaservices";
import { v4 as uuidv4 } from "uuid";
/**
 * IMPORTANT : This is an actual test, with the actual Azure Media Services API, it can cost money
 * Testing out the in real condition.
 * This "test" isn't really testing the code as it is running the function. This is why it is skipped
 * by default.
 * As this is more or less sugar coating of the original API, this shouldn't be too exhaustive.
 */
describe.skip("Using Azure Media Services in real condition", () => {
  let azClient: AzureMediaClient;
  let loginOptions: IAzLoginCredentials;
  let storageAccount: IStorageAccountOptions;
  // Load actual env variables from local.settings.json
  beforeAll(() => {
    const localSettings = JSON.parse(
      readFileSync(join(__dirname, "../../local.settings.json"), {
        encoding: "utf-8",
      })
    );
    Object.entries(localSettings.Values).forEach(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ([key, value]) => (env[key] = value)
    );
    env.NODE_ENV = "production";
    loginOptions = {
      clientId: env.AAD_CLIENT_ID,
      secret: env.AAD_SECRET,
      subId: env.SUBSCRIPTION_ID,
      tenant: env.AAD_TENANT_DOMAIN,
    };
    storageAccount = {
      resourceGroup: env.RESOURCE_GROUP,
      storageAccount: env.ACCOUNT_NAME,
    };
  });
  // Reset the client between each test
  beforeEach(() => {
    azClient = container.get(TYPES.Media);
  });

  it("Should login to media services", async () => {
    await expect(azClient.login(loginOptions)).resolves.not.toThrow();
  });

  // NOTE : Incomplete
  describe.skip("Full job", () => {
    const testAssetName = `test-asset-${uuidv4()}`;
    beforeAll(() => {
      // Upload file
    });

    it("Should be able to create an input asset", async () => {
      return;
    });

    it("Should be able to create an output asset", async () => {
      return;
    });

    it("Should be able to submit a job", async () => {
      return;
    });

    afterAll(async () => {
      const credentials = await container.get<AzureLoginProvider>(
        TYPES.AzureLoginProvider
      )(loginOptions.clientId, loginOptions.secret, loginOptions.tenant);
      const azMediaClient = container.get<(...args) => AzureMediaServices>(
        TYPES.AzureMediaServices
      )(credentials, loginOptions.subId);
      // Delete asset, obviously not not using the tested class
      azMediaClient.assets.deleteMethod(
        storageAccount.resourceGroup,
        storageAccount.storageAccount,
        testAssetName
      );
      // Remove file
    });
  });

  it("Should be able to retrieve a transform", async () => {
    await azClient.login(loginOptions);
    await expect(
      azClient.setEncodingPreset(env.TRANSFORM_NAME, storageAccount)
    ).resolves.not.toThrow();
  });

  it("Should be able to create a transform", async () => {
    return;
  });
});
