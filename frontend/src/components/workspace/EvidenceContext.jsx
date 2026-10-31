import { createContext, useContext } from 'react';

/**
 * Shared lookups for findings: sources (with S1, S2… labels), extracted
 * claims, and a function to open the source inspector at a passage.
 */
export const EvidenceContext = createContext({
  sourcesById: {},
  claimsById: {},
  openSource: () => {},
});

export const useEvidence = () => useContext(EvidenceContext);

export function buildSourceIndex(sources) {
  return Object.fromEntries(sources.map((source, index) => [source.id, { ...source, label: `S${index + 1}` }]));
}
