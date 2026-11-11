// Agent execution boundary. Model calls are disabled until verified free entitlement
// and separately reviewed permissions. No implicit fallback to paid APIs.
export function planAgentRun({task, modelAccess, budget, permissions} = {}) {
 if (!task || !Number.isSafeInteger(task.number)) return {status:'blocked',reason:'no approved task'};
 if (modelAccess?.verifiedFree !== true || modelAccess?.providerApproved !== true)
   return {status:'blocked',reason:'model entitlement not verified'};
 if (budget?.maxChargeUsd !== 0 || budget?.enforced !== true)
   return {status:'blocked',reason:'zero-dollar budget not enforced'};
 if (permissions?.syntheticOnly !== true || permissions?.draftPrOnly !== true ||
     permissions?.deploy === true || permissions?.profileAccess === true ||
     permissions?.merge === true)
   return {status:'blocked',reason:'unsafe permissions'};
 return {status:'ready-for-isolated-review',taskNumber:task.number};
}
