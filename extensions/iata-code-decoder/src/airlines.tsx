import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useRef, useCallback } from "react";
import fetch, { AbortError } from "node-fetch";
import { AbortSignal as NodeFetchAbortSignal } from "./types";
import { first } from "./utils";

export interface Airline {
  id: string;
  name: string;
  iataCode: string;
  logoLockupUrl?: string;
  logoSymbolUrl?: string;
  conditionsOfCarriageUrl?: string;
}

interface AirlineSearchState {
  results: Airline[];
  isLoading: boolean;
}

interface AirlineSearchSuccessResponse {
  data: Airline[];
}

interface AirlineSearchErrorResponse {
  data: {
    error: string;
  };
}

type AirlineSearchResponse = AirlineSearchSuccessResponse | AirlineSearchErrorResponse;

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List
      isLoading={state.isLoading}
      onSearchTextChange={search}
      searchBarPlaceholder="Enter airline IATA code..."
      throttle
    >
      <List.Section title="Airlines" subtitle={state.results.length + ""}>
        {state.results.map((airline) => (
          <AirlineListItem key={airline.id} airline={airline} />
        ))}
      </List.Section>
    </List>
  );
}

function AirlineListItem({ airline }: { airline: Airline }) {
  return (
    <List.Item
      title={airline.iataCode}
      subtitle={airline.name}
      icon={airline.logoSymbolUrl}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Name to Clipboard" content={airline.name} />
            {airline.conditionsOfCarriageUrl && (
              <Action.OpenInBrowser title="Open Conditions of Carriage" url={airline.conditionsOfCarriageUrl} />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function useSearch(): { state: AirlineSearchState; search: (text: string) => void } {
  const [state, setState] = useState<AirlineSearchState>({ results: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();

      if (searchText === "") {
        return setState((oldState) => ({
          ...oldState,
          isLoading: false,
          results: [],
        }));
      }

      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));
      try {
        const results = await performSearch(searchText, cancelRef.current.signal);
        setState((oldState) => ({
          ...oldState,
          results: first(results, 50),
          isLoading: false,
        }));
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("Search error", error);
        showToast({ style: Toast.Style.Failure, title: "Oops! Something went wrong.", message: String(error) });
      }
    },
    [cancelRef, setState]
  );

  useEffect(() => {
    search("");
    return () => {
      cancelRef.current?.abort();
    };
  }, []);

  return {
    state: state,
    search: search,
  };
}

async function performSearch(searchText: string, signal: AbortSignal): Promise<Airline[]> {
  const params = new URLSearchParams();
  params.append("query", searchText);

  const response = await fetch("https://iata-code-decoder-api.onrender.com/airlines" + "?" + params.toString(), {
    method: "get",
    // Typescript's idea of an AbortSignal and node-fetch's idea of an AbortSignal
    // don't seem to match. This handles it.
    signal: signal as NodeFetchAbortSignal,
  });

  const json = (await response.json()) as AirlineSearchResponse;

  if (!response.ok) {
    throw new Error(response.statusText);
  } else if ("error" in json.data) {
    throw new Error(json.data.error);
  } else {
    return json.data;
  }
}
