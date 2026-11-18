import {
  DirectoryEntry,
  DirectoryEntryInput,
  DirectoryImportRow,
  DirectoryImportResult,
} from "@/types/directory";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";

const DIRECTORY_PATH = "/directory";

export const DirectoryService = {
  list: async () => {
    return apiGet<DirectoryEntry[]>(DIRECTORY_PATH);
  },

  create: async (input: DirectoryEntryInput) => {
    return apiPost<DirectoryEntry>(DIRECTORY_PATH, input);
  },

  update: async (entryId: string, input: DirectoryEntryInput) => {
    return apiPut<DirectoryEntry>(`${DIRECTORY_PATH}/${entryId}`, input);
  },

  remove: async (entryId: string) => {
    await apiDelete(`${DIRECTORY_PATH}/${entryId}`);
  },

  importRows: async (rows: DirectoryImportRow[]) => {
    return apiPost<DirectoryImportResult>(`${DIRECTORY_PATH}/import`, { rows });
  },
};
