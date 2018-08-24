import queryString, { ParseOptions, StringifyOptions } from "query-string";
import React from "react";
import { RouteComponentProps } from "react-router-dom";

export interface QueryStringData {
  [key: string]: any;
}

export interface SetQueryStringOptions extends StringifyOptions {
  stateOnly?: boolean;
}

export type SetQueryString = (data: object, options?: SetQueryStringOptions) => void;
export type SyncStateWithQueryString = (state?: object) => void;

export interface QueryStringInjectedProps<T = QueryStringData> {
  queryString: {
    setQueryString: SetQueryString;
    state: T;
    syncStateWithQueryString: SyncStateWithQueryString;
  };
}

export type ParserTransform<T> = (data: QueryStringData) => T;

export interface Options {
  parse?: ParseOptions;
  stringify?: StringifyOptions;
}

export type WrappedComponentProps<P> = P & QueryStringInjectedProps & RouteComponentProps<any>;
export type WrappedComponentType<P> = React.ComponentType<WrappedComponentProps<P>>;

export type InjectQueryStringReturnType = <P, T extends WrappedComponentProps<P>>(
  WrappedComponent: WrappedComponentType<P>,
) => React.ComponentClass<T>;

interface State {
  queryString: QueryStringInjectedProps["queryString"];
}

function withQueryString(options?: Options): InjectQueryStringReturnType;
function withQueryString<R>(transform: ParserTransform<R>, options?: Options): InjectQueryStringReturnType;
function withQueryString<R>(
  transformOrOptions?: ParserTransform<R> | Options, options?: Options,
): InjectQueryStringReturnType {
  let parseTransform: ParserTransform<R> | undefined;

  if (typeof transformOrOptions === "function" ) {
    parseTransform = transformOrOptions;
  } else {
    options = transformOrOptions;
  }

  options = options || {};

  return <P, T extends WrappedComponentProps<P>>(WrappedComponent: WrappedComponentType<P>) => {
    return class QueryString extends React.Component<T, State> {
      private stateQuery: string = this.sortQuery(this.props.location.search);

      public constructor(...args: any[]) {
        // @ts-ignore
        super(...args);

        this.state = {
          queryString: {
            setQueryString: this.setQueryString,
            state: this.parseQueryString(this.props.location.search),
            syncStateWithQueryString: this.syncStateWithQueryString,
          },
        };
      }

      public componentDidUpdate(prevProps: T) {
        if (this.props.location.search === prevProps.location.search) {
          return;
        }

        const currentQuery = this.sortQuery(this.props.location.search);

        if (currentQuery === this.stateQuery) {
          return;
        }

        this.stateQuery = currentQuery;

        this.setState({
          queryString: {
            ...this.state.queryString,
            state: this.parseQueryString(this.stateQuery),
          },
        });
      }

      private sortQuery(query: string): string {
        let prefix: string = "";
        let params: string = query;

        if (/^\?/.test(query)) {
          prefix = "?";
          params = query.substring(1);
        }

        return prefix + params.split("&").sort().join("&");
      }

      private parseQueryString(query: string) {
        const data = queryString.parse(query, options!.parse);
        return parseTransform ? parseTransform(data) : data;
      }

      private syncStateWithQueryString: SyncStateWithQueryString = (state = this.state.queryString.state) => {
        this.props.history.push(this.props.location.pathname + this.stateQuery, state);
      }

      private setQueryString: SetQueryString = (
        state, { stateOnly = false, ...stringifyOptions }: SetQueryStringOptions = options!.stringify || {},
      ) => {
        this.stateQuery = this.sortQuery("?" + queryString.stringify(state, stringifyOptions));

        this.setState({
          queryString: {
            ...this.state.queryString,
            state,
          },
        });

        if (!stateOnly) {
          this.syncStateWithQueryString();
        }
      }

      public render() {
        return <WrappedComponent {...this.props} queryString={this.state.queryString}/>;
      }
    };
  };
}

export default withQueryString;
