import { allEnginesWorkflow, getWorkflow as lookupWorkflow, type EngineWorkflow } from '../domain/workflow.js'
import { INCIDENT_CATALOGUE, incidentTypesFor } from '../domain/incidents.js'
import { INCIDENT_LABELS } from '../constants/labels.constants.js'

function serialize(wf: EngineWorkflow) {
  return {
    engineKind: wf.engineKind,
    assetKind: wf.assetKind,
    sessionKind: wf.sessionKind,
    initialStatus: wf.initialStatus,
    actors: wf.actors,
    transitions: wf.transitions.map((t) => ({
      code: t.code,
      label: t.label,
      source: t.source,
      target: t.target,
      actors: t.actors,
      style: t.style,
    })),
  }
}

export function listWorkflows() {
  return Object.values(allEnginesWorkflow).map(serialize)
}

export function getWorkflowByKind(kind: string) {
  const wf = lookupWorkflow(kind)
  return wf ? serialize(wf) : null
}

export function listIncidentCatalogue() {
  return {
    labels: INCIDENT_LABELS,
    byEngine: INCIDENT_CATALOGUE,
    all: incidentTypesFor(),
  }
}
