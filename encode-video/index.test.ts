import "reflect-metadata";

import { Substitute } from "@fluffy-spoon/substitute";
import { Context } from "@azure/functions";
import func from "./index";
import { MissingEnvError } from "../common";
import { env } from "process";

describe("Should handle common errors gracefully", () => {
  it("No all env variable are defined", async () => {
    const [context, request] = formatBlobContext("test", 250);
    await expect(func(context, request)).rejects.toThrow(MissingEnvError);
  });
});

describe("Using mock media services", () => {
  const localSettings = {
    IsEncrypted: false,
    Values: {
      AzureWebJobsStorage: "",
      FUNCTIONS_WORKER_RUNTIME: "node",
      InputContainer: "test",
      AAD_CLIENT_ID: "test",
      AAD_SECRET: "test",
      AAD_TENANT_DOMAIN: "test",
      SUBSCRIPTION_ID: "test",
      TRANSFORM_NAME: "test",
      RESOURCE_GROUP: "test",
      MEDIA_SERVICES_NAME: "test",
      INPUT_CONTAINER: "test",
      STORAGE_CONNECTION_STRING: "test",
      OUTPUT_CONTAINER_PREFIX: "test",
    },
  };
  beforeAll(() => {
    Object.entries(localSettings.Values).forEach(
      ([key, value]) => (env[key] = value)
    );
  });
  it("All env variables are defined", async () => {
    const [context, request] = formatBlobContext("test", 250);
    await expect(func(context, request)).resolves.not.toThrow();
  });
});

/**
 * Returns mocked Az function Context and Blob to test a function without a server
 * @param blobName Name of the incoming Blob
 * @param blobSize Size of the incoming Blob
 * @returns
 */
function formatBlobContext(
  blobName: string,
  blobSize: number
): [Context, { length: number }] {
  // Mocking the incoming blob
  const myBlob = Substitute.for<{ length: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (myBlob as any).returns({ length: blobSize });

  // Mocking the context, especially overriding the storage binding
  const context = Substitute.for<Context>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (context.bindings as any).returns({ storage: undefined });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (context.bindingData as any).returns({ name: blobName });

  return [context, myBlob];
}
