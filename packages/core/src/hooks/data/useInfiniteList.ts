import { getXRay } from "@refinedev/devtools-internal";
import {
    InfiniteData,
    InfiniteQueryObserverResult,
    useInfiniteQuery,
    UseInfiniteQueryOptions,
} from "@tanstack/react-query";

import {
    getNextPageParam,
    getPreviousPageParam,
    handlePaginationParams,
    pickDataProvider,
    pickNotDeprecated,
    useActiveAuthProvider,
} from "@definitions/helpers";
import {
    useDataProvider,
    useHandleNotification,
    useMeta,
    useOnError,
    useResource,
    useResourceSubscription,
    useTranslate,
} from "@hooks";
import {
    BaseRecord,
    CrudFilters,
    CrudSorting,
    GetListResponse,
    HttpError,
    LiveModeProps,
    MetaQuery,
    Pagination,
    Prettify,
    SuccessErrorNotification,
} from "../../interfaces";

import { useKeys } from "@hooks/useKeys";
import {
    useLoadingOvertime,
    UseLoadingOvertimeOptionsProps,
    UseLoadingOvertimeReturnType,
} from "../useLoadingOvertime";

export interface UseInfiniteListConfig {
    pagination?: Pagination;
    hasPagination?: boolean;
    sort?: CrudSorting;
    filters?: CrudFilters;
}

type BaseInfiniteListProps = {
    /**
     *  Metadata query for `dataProvider`
     */
    meta?: MetaQuery;
    /**
     *  Metadata query for `dataProvider`
     *  @deprecated `metaData` is deprecated with refine@4, refine will pass `meta` instead, however, we still support `metaData` for backward compatibility.
     */
    metaData?: MetaQuery;
    /**
     * Configuration for pagination, sorting and filtering
     * @type [`useInfiniteListConfig`](/docs/api-reference/core/hooks/data/useInfiniteList/#config-parameters)
     * @deprecated `config` property is deprecated. Use `pagination`, `hasPagination`, `sorters` and `filters` instead.
     */
    config?: UseInfiniteListConfig;
    /**
     * Pagination properties
     */
    pagination?: Pagination;
    /**
     * Whether to use server-side pagination or not
     * @deprecated `hasPagination` property is deprecated. Use `pagination.mode` instead.
     */
    hasPagination?: boolean;
    /**
     * Sorter parameters
     */
    sorters?: CrudSorting;
    /**
     * Filter parameters
     */
    filters?: CrudFilters;
    /**
     * If there is more than one `dataProvider`, you should use the `dataProviderName` that you will use
     */
    dataProviderName?: string;
};

export type UseInfiniteListProps<TQueryFnData, TError, TData> = {
    /**
     * Resource name for API data interactions
     */
    resource: string;
    /**
     * Tanstack Query's [useInfiniteQuery](https://tanstack.com/query/v4/docs/react/reference/useInfiniteQuery) options
     */
    queryOptions?: UseInfiniteQueryOptions<
        GetListResponse<TQueryFnData>,
        TError,
        GetListResponse<TData>
    >;
} & BaseInfiniteListProps &
    SuccessErrorNotification<
        InfiniteData<GetListResponse<TData>>,
        TError,
        Prettify<BaseInfiniteListProps>
    > &
    LiveModeProps &
    UseLoadingOvertimeOptionsProps;

/**
 * `useInfiniteList` is a modified version of `react-query`'s {@link https://tanstack.com/query/latest/docs/react/guides/infinite-queries `useInfiniteQuery`} used for retrieving items from a `resource` with pagination, sort, and filter configurations.
 *
 * It uses the `getList` method as the query function from the `dataProvider` which is passed to `<Refine>`.
 *
 * @see {@link https://refine.dev/docs/api-reference/core/hooks/data/useInfiniteList} for more details.
 *
 * @typeParam TQueryFnData - Result data returned by the query function. Extends {@link https://refine.dev/docs/api-reference/core/interfaceReferences#baserecord `BaseRecord`}
 * @typeParam TError - Custom error object that extends {@link https://refine.dev/docs/api-reference/core/interfaceReferences#httperror `HttpError`}
 * @typeParam TData - Result data returned by the `select` function. Extends {@link https://refine.dev/docs/api-reference/core/interfaceReferences#baserecord `BaseRecord`}. Defaults to `TQueryFnData`
 *
 */

export const useInfiniteList = <
    TQueryFnData extends BaseRecord = BaseRecord,
    TError extends HttpError = HttpError,
    TData extends BaseRecord = TQueryFnData,
>({
    resource: resourceFromProp,
    config,
    filters,
    hasPagination,
    pagination,
    sorters,
    queryOptions,
    successNotification,
    errorNotification,
    meta,
    metaData,
    liveMode,
    onLiveEvent,
    liveParams,
    dataProviderName,
    overtimeOptions,
}: UseInfiniteListProps<
    TQueryFnData,
    TError,
    TData
>): InfiniteQueryObserverResult<GetListResponse<TData>, TError> &
    UseLoadingOvertimeReturnType => {
    const { resources, resource, identifier } = useResource(resourceFromProp);

    const dataProvider = useDataProvider();
    const translate = useTranslate();
    const authProvider = useActiveAuthProvider();
    const { mutate: checkError } = useOnError({
        v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
    });
    const handleNotification = useHandleNotification();
    const getMeta = useMeta();
    const { keys, preferLegacyKeys } = useKeys();

    const pickedDataProvider = pickDataProvider(
        identifier,
        dataProviderName,
        resources,
    );
    const preferredMeta = pickNotDeprecated(meta, metaData);
    const prefferedFilters = pickNotDeprecated(filters, config?.filters);
    const prefferedSorters = pickNotDeprecated(sorters, config?.sort);
    const prefferedHasPagination = pickNotDeprecated(
        hasPagination,
        config?.hasPagination,
    );
    const prefferedPagination = handlePaginationParams({
        pagination,
        configPagination: config?.pagination,
        hasPagination: prefferedHasPagination,
    });
    const isServerPagination = prefferedPagination.mode === "server";
    const notificationValues = {
        meta: preferredMeta,
        metaData: preferredMeta,
        filters: prefferedFilters,
        hasPagination: isServerPagination,
        pagination: prefferedPagination,
        sorters: prefferedSorters,
        config: {
            ...config,
            sort: prefferedSorters,
        },
    };

    const isEnabled =
        queryOptions?.enabled === undefined || queryOptions?.enabled === true;

    const combinedMeta = getMeta({ resource, meta: preferredMeta });

    const { getList } = dataProvider(pickedDataProvider);

    useResourceSubscription({
        resource: identifier,
        types: ["*"],
        params: {
            meta: combinedMeta,
            metaData: combinedMeta,
            pagination: prefferedPagination,
            hasPagination: isServerPagination,
            sort: prefferedSorters,
            sorters: prefferedSorters,
            filters: prefferedFilters,
            subscriptionType: "useList",
            ...liveParams,
        },
        channel: `resources/${resource.name}`,
        enabled: isEnabled,
        liveMode,
        onLiveEvent,
        dataProviderName: pickedDataProvider,
        meta: {
            ...combinedMeta,
            dataProviderName,
        },
    });

    const queryResponse = useInfiniteQuery<
        GetListResponse<TQueryFnData>,
        TError,
        GetListResponse<TData>
    >(
        keys()
            .data(pickedDataProvider)
            .resource(identifier)
            .action("infinite")
            .params({
                ...(preferredMeta || {}),
                filters: prefferedFilters,
                hasPagination: isServerPagination,
                ...(isServerPagination && {
                    pagination: prefferedPagination,
                }),
                ...(sorters && {
                    sorters,
                }),
                ...(config?.sort && {
                    sort: config?.sort,
                }),
            })
            .get(preferLegacyKeys),
        ({ queryKey, pageParam, signal }) => {
            const paginationProperties = {
                ...prefferedPagination,
                current: pageParam,
            };

            return getList<TQueryFnData>({
                resource: resource.name,
                pagination: paginationProperties,
                hasPagination: isServerPagination,
                filters: prefferedFilters,
                sort: prefferedSorters,
                sorters: prefferedSorters,
                meta: {
                    ...combinedMeta,
                    queryContext: {
                        queryKey,
                        pageParam,
                        signal,
                    },
                },
                metaData: {
                    ...combinedMeta,
                    queryContext: {
                        queryKey,
                        pageParam,
                        signal,
                    },
                },
            }).then(({ data, total, ...rest }) => {
                return {
                    data,
                    total,
                    pagination: paginationProperties,
                    ...rest,
                };
            });
        },
        {
            getNextPageParam: (lastPage) => getNextPageParam(lastPage),
            getPreviousPageParam: (lastPage) => getPreviousPageParam(lastPage),
            ...queryOptions,
            onSuccess: (data) => {
                queryOptions?.onSuccess?.(data);

                const notificationConfig =
                    typeof successNotification === "function"
                        ? successNotification(
                              data,
                              notificationValues,
                              identifier,
                          )
                        : successNotification;

                handleNotification(notificationConfig);
            },
            onError: (err: TError) => {
                checkError(err);
                queryOptions?.onError?.(err);

                const notificationConfig =
                    typeof errorNotification === "function"
                        ? errorNotification(err, notificationValues, identifier)
                        : errorNotification;

                handleNotification(notificationConfig, {
                    key: `${identifier}-useInfiniteList-notification`,
                    message: translate(
                        "notifications.error",
                        { statusCode: err.statusCode },
                        `Error (status code: ${err.statusCode})`,
                    ),
                    description: err.message,
                    type: "error",
                });
            },
            meta: {
                ...queryOptions?.meta,
                ...getXRay("useInfiniteList", preferLegacyKeys),
            },
        },
    );

    const { elapsedTime } = useLoadingOvertime({
        isLoading: queryResponse.isFetching,
        interval: overtimeOptions?.interval,
        onInterval: overtimeOptions?.onInterval,
    });

    return { ...queryResponse, overtime: { elapsedTime } };
};
