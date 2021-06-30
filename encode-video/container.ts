import { AzureMediaServices } from "@azure/arm-mediaservices";
import { Container, interfaces } from "inversify";
import { AzureLoginProvider, IMediaClient } from "./@types/media-client";
import { AzureMediaClient } from "./services/azure-media-services/azure-media-client.service";
import { MockMediaClient } from "./services/mocks/mock-media-client";
import { loginWithServicePrincipalSecret } from "@azure/ms-rest-nodeauth";
import TYPES from "./types";

const container = new Container();

// Set the actual Media Service client as an injected dependency
// This will allow us to test the client without testing the external api
container
  .bind<AzureLoginProvider>(TYPES.AzureLoginProvider)
  .toConstantValue(loginWithServicePrincipalSecret);

container
  .bind<interfaces.Factory<AzureMediaServices>>(TYPES.AzureMediaServices)
  .toFactory<AzureMediaServices>(
    () => (credentials: never, subId: string) =>
      new AzureMediaServices(credentials, subId)
  );

// Only actually use Azure Media services in production
container
  .bind<IMediaClient>(TYPES.Media)
  .toDynamicValue((context) =>
    process.env.NODE_ENV === "production"
      ? new AzureMediaClient(
          context.container.get(TYPES.AzureMediaServices),
          context.container.get(TYPES.AzureLoginProvider)
        )
      : new MockMediaClient()
  );

export default container;
