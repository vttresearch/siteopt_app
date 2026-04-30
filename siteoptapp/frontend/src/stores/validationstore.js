import { ref } from "vue";
import { defineStore } from "pinia";

export function createValidationSummary({
  invalidCount = 0,
  filetype = null,
  sheets = {},
} = {}) {
  return {
    invalidCount: Number(invalidCount) || 0,
    filetype,
    sheets: sheets && typeof sheets === "object" ? sheets : {},
  };
}

function normalizeIssuesMap(issues = {}) {
  return issues && typeof issues === "object" ? issues : {};
}

export const useValidationStore = defineStore("validationStore", () => {
  const cachedSummariesByPath = ref({});
  const issuesByPath = ref({});

  function reset() {
    cachedSummariesByPath.value = {};
    issuesByPath.value = {};
  }

  function setCachedSummariesByPath(entries) {
    const nextEntries = {};

    for (const [path, summary] of Object.entries(entries ?? {})) {
      nextEntries[path] = createValidationSummary(summary);
    }

    cachedSummariesByPath.value = nextEntries;
  }

  function setCachedSummary(path, summary) {
    if (!path) return;

    cachedSummariesByPath.value = {
      ...cachedSummariesByPath.value,
      [path]: createValidationSummary(summary),
    };
  }

  function clearCachedSummary(path) {
    if (!path) return;

    const nextEntries = { ...cachedSummariesByPath.value };
    delete nextEntries[path];
    cachedSummariesByPath.value = nextEntries;
  }

  function ensureFileIssues(path, filetype = null) {
    if (!path) return null;

    const current = issuesByPath.value[path];
    if (current) {
      if (filetype && current.filetype !== filetype) {
        issuesByPath.value = {
          ...issuesByPath.value,
          [path]: {
            ...current,
            filetype,
          },
        };
      }
      return issuesByPath.value[path];
    }

    const nextFileIssues = {
      filetype,
      scopes: {},
    };

    issuesByPath.value = {
      ...issuesByPath.value,
      [path]: nextFileIssues,
    };

    return nextFileIssues;
  }

  function setScopeIssues(path, filetype, scopeName, issues = {}) {
    if (!path || !scopeName) return;

    const current = ensureFileIssues(path, filetype);
    issuesByPath.value = {
      ...issuesByPath.value,
      [path]: {
        ...current,
        filetype: filetype ?? current?.filetype ?? null,
        scopes: {
          ...(current?.scopes ?? {}),
          [scopeName]: normalizeIssuesMap(issues),
        },
      },
    };
  }

  function clearFileIssues(path) {
    if (!path) return;

    const nextEntries = { ...issuesByPath.value };
    delete nextEntries[path];
    issuesByPath.value = nextEntries;
  }

  function getScopeIssues(path, scopeName) {
    return issuesByPath.value[path]?.scopes?.[scopeName] ?? {};
  }

  function getScopeInvalidCount(path, scopeName) {
    return Object.keys(getScopeIssues(path, scopeName)).length;
  }

  function getValidationSummary(path, fallbackFiletype = null) {
    const liveIssues = issuesByPath.value[path];
    if (!liveIssues) {
      return createValidationSummary(
        cachedSummariesByPath.value[path] ?? { filetype: fallbackFiletype },
      );
    }

    const scopes = liveIssues.scopes ?? {};
    const filetype = liveIssues.filetype ?? fallbackFiletype ?? null;

    if (filetype === "xlsx") {
      const sheets = {};
      let invalidCount = 0;

      for (const [scopeName, scopeIssues] of Object.entries(scopes)) {
        const scopeInvalidCount = Object.keys(scopeIssues ?? {}).length;
        sheets[scopeName] = { invalidCount: scopeInvalidCount };
        invalidCount += scopeInvalidCount;
      }

      return createValidationSummary({
        invalidCount,
        filetype,
        sheets,
      });
    }

    const activeScopeName = Object.keys(scopes)[0];
    return createValidationSummary({
      invalidCount: activeScopeName ? Object.keys(scopes[activeScopeName] ?? {}).length : 0,
      filetype,
      sheets: {},
    });
  }

  return {
    cachedSummariesByPath,
    issuesByPath,
    reset,
    setCachedSummariesByPath,
    setCachedSummary,
    clearCachedSummary,
    setScopeIssues,
    clearFileIssues,
    getScopeIssues,
    getScopeInvalidCount,
    getValidationSummary,
  };
});
