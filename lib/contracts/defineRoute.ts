import { z } from "zod";

import type { ApiPath } from "../standards/pathTypes";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type ResponseType = "json" | "response";

export type RouteBuilder = (...args: unknown[]) => ApiPath;

export type RoutePath<Builder extends RouteBuilder = RouteBuilder> = {
  template: ApiPath | string;
  build: Builder;
  params?: readonly string[];
};

export type ContractRoute<TRequest extends z.ZodTypeAny = z.ZodTypeAny, TResponse extends z.ZodTypeAny = z.ZodTypeAny> = {
  kind: "route";
  method: HttpMethod;
  path?: ApiPath;
  pathTemplate: ApiPath | string;
  buildPath: RouteBuilder;
  params: readonly string[];
  request: TRequest;
  response: TResponse;
  errors: readonly string[];
  responseType: ResponseType;
};

export type StaticRouteInput<TRequest extends z.ZodTypeAny, TResponse extends z.ZodTypeAny> = {
  method: HttpMethod | Lowercase<HttpMethod>;
  path: ApiPath;
  request?: TRequest;
  response: TResponse;
  errors?: readonly string[];
  responseType?: ResponseType;
};

export type DynamicRouteInput<
  Builder extends RouteBuilder,
  TRequest extends z.ZodTypeAny,
  TResponse extends z.ZodTypeAny,
> = {
  method: HttpMethod | Lowercase<HttpMethod>;
  pathTemplate: ApiPath | string;
  buildPath: Builder;
  params?: readonly string[];
  request?: TRequest;
  response: TResponse;
  errors?: readonly string[];
  responseType?: ResponseType;
};

export type LegacyRouteInput<
  Builder extends RouteBuilder,
  TRequest extends z.ZodTypeAny,
  TResponse extends z.ZodTypeAny,
> = {
  method: HttpMethod | Lowercase<HttpMethod>;
  path: RoutePath<Builder>;
  request?: TRequest;
  response: TResponse;
  errors?: readonly string[];
  responseType?: ResponseType;
};

export type DefineRouteInput<TRequest extends z.ZodTypeAny, TResponse extends z.ZodTypeAny> =
  | StaticRouteInput<TRequest, TResponse>
  | DynamicRouteInput<RouteBuilder, TRequest, TResponse>
  | LegacyRouteInput<RouteBuilder, TRequest, TResponse>;

const DEFAULT_REQUEST = z.object({}).optional();

export function routePath<Builder extends (...args: unknown[]) => ApiPath>(
  template: ApiPath | string,
  build: Builder,
  params: readonly string[] = [],
): RoutePath<Builder> {
  return { template, build, params };
}

const isRoutePath = (value: unknown): value is RoutePath => {
  if (!value || typeof value !== "object") return false;
  return "template" in value && "build" in value;
};

export function defineRoute<TRequest extends z.ZodTypeAny, TResponse extends z.ZodTypeAny>(
  input: DefineRouteInput<TRequest, TResponse>,
): ContractRoute<TRequest, TResponse> {
  const method = input.method.toUpperCase() as HttpMethod;
  const template =
    "pathTemplate" in input
      ? input.pathTemplate
      : isRoutePath(input.path)
        ? input.path.template
        : input.path;
  const buildPath: RouteBuilder = (() => {
    if ("buildPath" in input) {
      return input.buildPath;
    }
    if ("path" in input && isRoutePath(input.path)) {
      return input.path.build;
    }
    if ("path" in input) {
      return () => input.path as ApiPath;
    }
    return () => {
      throw new Error("Missing build path");
    };
  })();
  const params =
    "params" in input
      ? input.params ?? []
      : "path" in input && isRoutePath(input.path)
        ? input.path.params ?? []
        : [];
  const path = "path" in input && !isRoutePath(input.path) ? input.path : undefined;

  if (typeof template !== "string" || !template.startsWith("/api/")) {
    throw new Error(`Contract path must start with /api/: ${template}`);
  }

  return {
    kind: "route",
    method,
    path,
    pathTemplate: template,
    buildPath,
    params,
    request: (input.request ?? DEFAULT_REQUEST) as TRequest,
    response: input.response,
    errors: input.errors ?? [],
    responseType: input.responseType ?? "json",
  };
}
