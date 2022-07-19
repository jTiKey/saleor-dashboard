import { FetchResult } from "@apollo/client";
import {
  mergeAttributeValueDeleteErrors,
  mergeFileUploadErrors,
} from "@saleor/attributes/utils/data";
import {
  handleDeleteMultipleAttributeValues,
  handleUploadMultipleFiles,
} from "@saleor/attributes/utils/handlers";
import {
  AttributeErrorFragment,
  BulkStockErrorFragment,
  MetadataErrorFragment,
  ProductChannelListingErrorFragment,
  ProductErrorWithAttributesFragment,
  ProductFragment,
  StockErrorFragment,
  UploadErrorFragment,
  useAttributeValueDeleteMutation,
  useFileUploadMutation,
  useProductChannelListingUpdateMutation,
  useProductUpdateMutation,
  useProductVariantChannelListingUpdateMutation,
  useUpdateMetadataMutation,
  useUpdatePrivateMetadataMutation,
  useVariantDatagridStockUpdateMutation,
  useVariantDatagridUpdateMutation,
} from "@saleor/graphql";
import useNotifier from "@saleor/hooks/useNotifier";
import { commonMessages } from "@saleor/intl";
import { getMutationErrors } from "@saleor/misc";
import { ProductUpdateSubmitData } from "@saleor/products/components/ProductUpdatePage/form";
import {
  getStocks,
  getVariantInputs,
} from "@saleor/products/components/ProductVariants/utils";
import { getProductErrorMessage } from "@saleor/utils/errors";
import createMetadataUpdateHandler from "@saleor/utils/handlers/metadataUpdateHandler";
import { useIntl } from "react-intl";

import { getChannelsVariables, getProductUpdateVariables } from "./utils";

export type UseProductUpdateHandlerError =
  | ProductErrorWithAttributesFragment
  | AttributeErrorFragment
  | UploadErrorFragment
  | StockErrorFragment
  | BulkStockErrorFragment;

type UseProductUpdateHandler = (
  data: ProductUpdateSubmitData,
) => Promise<Array<UseProductUpdateHandlerError | MetadataErrorFragment>>;
interface UseProductUpdateHandlerOpts {
  called: boolean;
  loading: boolean;
  errors: UseProductUpdateHandlerError[];
  channelsErrors: ProductChannelListingErrorFragment[];
}

export function useProductUpdateHandler(
  product: ProductFragment,
): [UseProductUpdateHandler, UseProductUpdateHandlerOpts] {
  const intl = useIntl();
  const notify = useNotifier();

  const [updateMetadata, updateMetadataOpts] = useUpdateMetadataMutation({});
  const [
    updatePrivateMetadata,
    updatePrivateMetadataOpts,
  ] = useUpdatePrivateMetadataMutation({});
  const [
    updateStocks,
    updateStocksOpts,
  ] = useVariantDatagridStockUpdateMutation({});
  const [updateVariant, updateVariantOpts] = useVariantDatagridUpdateMutation();

  const [uploadFile, uploadFileOpts] = useFileUploadMutation();

  const [updateProduct, updateProductOpts] = useProductUpdateMutation();
  const [
    updateChannels,
    updateChannelsOpts,
  ] = useProductChannelListingUpdateMutation({
    onCompleted: data => {
      if (!!data.productChannelListingUpdate.errors.length) {
        data.productChannelListingUpdate.errors.forEach(error =>
          notify({
            status: "error",
            text: getProductErrorMessage(error, intl),
          }),
        );
      }
    },
  });

  const [
    updateVariantChannels,
    updateVariantChannelsOpts,
  ] = useProductVariantChannelListingUpdateMutation();

  const [
    deleteAttributeValue,
    deleteAttributeValueOpts,
  ] = useAttributeValueDeleteMutation();

  const sendMutations = createMetadataUpdateHandler(
    product,
    async (data: ProductUpdateSubmitData) => {
      let errors: UseProductUpdateHandlerError[] = [];

      const uploadFilesResult = await handleUploadMultipleFiles(
        data.attributesWithNewFileValue,
        variables => uploadFile({ variables }),
      );

      const deleteAttributeValuesResult = await handleDeleteMultipleAttributeValues(
        data.attributesWithNewFileValue,
        product?.attributes,
        variables => deleteAttributeValue({ variables }),
      );

      errors = [
        ...errors,
        ...mergeFileUploadErrors(uploadFilesResult),
        ...mergeAttributeValueDeleteErrors(deleteAttributeValuesResult),
      ];

      const result = await updateProduct({
        variables: getProductUpdateVariables(product, data, uploadFilesResult),
      });
      errors = [...errors, ...result.data.productUpdate.errors];

      const variantUpdateResult = await Promise.all<FetchResult>([
        ...getStocks(product.variants, data.variants).map(variables =>
          updateStocks({ variables }),
        ),
        ...getVariantInputs(product.variants, data.variants).map(variables =>
          updateVariant({ variables }),
        ),
      ]);
      errors = [
        ...errors,
        ...(variantUpdateResult.flatMap(getMutationErrors) as Array<
          StockErrorFragment | BulkStockErrorFragment
        >),
      ];

      await updateChannels({
        variables: getChannelsVariables(product, data),
      });

      return errors;
    },
    variables => updateMetadata({ variables }),
    variables => updatePrivateMetadata({ variables }),
  );

  const submit = async (data: ProductUpdateSubmitData) => {
    const errors = await sendMutations(data);

    if (errors.length === 0) {
      notify({
        status: "success",
        text: intl.formatMessage(commonMessages.savedChanges),
      });
    }

    return errors;
  };

  const called =
    updateMetadataOpts.called ||
    updatePrivateMetadataOpts.called ||
    uploadFileOpts.called ||
    updateProductOpts.called ||
    updateChannelsOpts.called ||
    updateVariantChannelsOpts.called ||
    deleteAttributeValueOpts.called ||
    updateStocksOpts.called ||
    updateVariantOpts.called;
  const loading =
    updateMetadataOpts.loading ||
    updatePrivateMetadataOpts.loading ||
    uploadFileOpts.loading ||
    updateProductOpts.loading ||
    updateChannelsOpts.loading ||
    updateVariantChannelsOpts.loading ||
    deleteAttributeValueOpts.loading ||
    updateStocksOpts.loading ||
    updateVariantOpts.loading;

  const errors = updateProductOpts.data?.productUpdate.errors ?? [];

  const channelsErrors = [
    ...(updateChannelsOpts?.data?.productChannelListingUpdate?.errors ?? []),
    ...(updateVariantChannelsOpts?.data?.productVariantChannelListingUpdate
      ?.errors ?? []),
  ];

  return [
    submit,
    {
      called,
      loading,
      channelsErrors,
      errors,
    },
  ];
}
