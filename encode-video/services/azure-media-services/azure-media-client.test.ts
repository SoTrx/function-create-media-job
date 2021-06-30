import "reflect-metadata";
import { AzureMediaServices } from "@azure/arm-mediaservices";
import Substitute from "@fluffy-spoon/substitute";
import { env } from "process";
import { IAzLoginCredentials } from "../../@types/media-client";
import container from "../../container";
import TYPES from "../../types";
import { AzureMediaClient } from "./azure-media-client.service";
/**
 * Testing out the Azure Media Client Service.
 * As this is more or less sugar coating of the original API, this shouldn't be too exhaustive.
 */
describe("Using Azure Media Services", () => {
  const loginOptions: IAzLoginCredentials = {
    clientId: "test",
    secret: "test",
    subId: "test",
    tenant: "test",
  };
  const testContainerOptions = {
    resourceGroup: "test",
    container: "test",
    storageAccount: "test",
  };
  let azClient: AzureMediaClient;
  // To test things out, we shouldn't have to use any Azure resource.
  // The first thing is to change all dependencies to mock one in the container
  beforeAll(() => {
    // Saving DI state before using all the mocks
    container.snapshot();

    // De-activating Azure auth, replacing it by a mock
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const nullAuth = async (..._args: string[]) => Promise.resolve(undefined);
    container.rebind(TYPES.AzureLoginProvider).toConstantValue(nullAuth);

    // Not letting the class use the actual Media Services.
    // This prevents unnecessary costs
    container
      .rebind(TYPES.AzureMediaServices)
      .toFactory(() => () => Substitute.for<AzureMediaServices>());

    // Finally, setting NODE_ENV to prod, enabling the container to resolves media services
    env.NODE_ENV = "production";
  });

  // Reset the client after each test
  beforeEach(() => {
    azClient = container.get(TYPES.Media);
  });

  afterAll(() => {
    // Resetting the container to its snapshot'ed state
    container.restore();
  });
  it("Should login to media services", async () => {
    await azClient.login(loginOptions);
  });

  it("Should prevent the user from doing anything before logging in to Media Services", async () => {
    await expect(azClient.setInput(undefined, undefined)).rejects.toThrow(
      /log/
    );
    await expect(azClient.setOutput(undefined, undefined)).rejects.toThrow(
      /log/
    );
    await expect(
      azClient.setEncodingPreset(undefined, undefined)
    ).rejects.toThrow(/log/);
  });
  it("Should be able to create an asset", async () => {
    await azClient.login(loginOptions);
    await azClient.setInput("test", testContainerOptions);
  });

  it("Should be able to submit a job", async () => {
    await azClient.login(loginOptions);
    await azClient.setInput("test", testContainerOptions);
    await azClient.setOutput("test", testContainerOptions);
    await azClient.setEncodingPreset("test", testContainerOptions);
    await azClient.submitJob("test", testContainerOptions);
  });
  it("Should prevent the user to submit an incomplete job", async () => {
    await azClient.login(loginOptions);
    await azClient.setInput("test", testContainerOptions);
    await expect(azClient.submitJob(undefined, undefined)).rejects.toThrow(
      /must be defined/
    );
  });
});
