import type { ApplicationTokenCredentials } from "@azure/ms-rest-nodeauth";

/** Generic login interface, must be extended for every implementation */
export type AzureLoginProvider = (
  clientId: string,
  secret: string,
  tenant: string
) => Promise<ApplicationTokenCredentials>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILoginCredentials {}

/** Azure Media Services login interface
 * All infos are found in the "API Access" tab in Media Services
 * @see https://docs.microsoft.com/en-us/azure/media-services/latest/access-api-howto?tabs=portal
 */
export interface IAzLoginCredentials extends ILoginCredentials {
  /**API client id*/
  clientId: string;
  /**API secret **/
  secret: string;
  /** Tenant the azure media service is into */
  tenant: string;
  /** Subscription the Azure Media service is into */
  subId: string;
}

/** Definition of a storage account */
export interface IStorageAccountOptions {
  /**Name of the resource group the storage account is into */
  resourceGroup: string;
  /** Storage account name the container is into */
  storageAccount: string;
}
/** Definition of a storage account container */
export interface IContainerOptions extends IStorageAccountOptions {
  /**Blob container name */
  container: string;
}

/**
 * Media client definition. This enforces a fluent builder pattern on all implementation
 */
export interface IMediaClient {
  /** Connect to the remote media client*/
  login<T extends ILoginCredentials>(options: T): Promise<IMediaClient>;
  /**
   * Set source file (in a storage container) to transcode
   * @param name filename
   * @param container storage account container options
   */
  setInput(name: string, container: IContainerOptions): Promise<IMediaClient>;
  /**
   * Set target file (in a storage container)
   * @param name filename
   * @param container storage account container options
   */
  setOutput(name: string, container: IContainerOptions): Promise<IMediaClient>;
  /**
   * Set encoding params to use. Attempt to fetch them by name, create it otherwise.
   * @param name name of the preset to use. See specific implementations for details.
   * @param container container infos
   * @param presetDefinition preset parameter to use if it doesn't exists yet. See specific implementations for details
   */
  setEncodingPreset<T>(
    name: string,
    container: IStorageAccountOptions,
    presetDefinition?: T
  ): Promise<IMediaClient>;
  /**
   * Start transcoding.
   * @param jobName Encoding task's name
   * @param storageAccount storage account infos
   */
  submitJob(
    jobName: string,
    storageAccount: IStorageAccountOptions
  ): Promise<IMediaClient>;
}
