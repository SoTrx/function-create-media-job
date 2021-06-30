/**
 * NO-OP implementation of a Media Client. Doesn't do anything.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  IContainerOptions,
  ILoginCredentials,
  IMediaClient,
  IStorageAccountOptions,
} from "../../@types/media-client";

export class MockMediaClient implements IMediaClient {
  async setOutput(
    name: string,
    container: IContainerOptions
  ): Promise<IMediaClient> {
    return;
  }
  async setEncodingPreset<T>(
    name: string,
    container: IStorageAccountOptions,
    presetDefinition?: T
  ): Promise<IMediaClient> {
    return this;
  }
  async submitJob(
    jobName: string,
    storageAccount: IStorageAccountOptions
  ): Promise<IMediaClient> {
    return this;
  }
  async login<T extends ILoginCredentials>(options: T): Promise<IMediaClient> {
    return this;
  }

  async setInput(
    name: string,
    container: IContainerOptions
  ): Promise<IMediaClient> {
    return this;
  }
}
