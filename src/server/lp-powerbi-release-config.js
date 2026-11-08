import {powerBIExportMode} from './lp-powerbi-export-mode.js';
/** Non-secret, reviewed release choice. Does not enable SQL or replace session/scope guards. */
export const POWERBI_RELEASE_MODE='LP-EXPORT-DUAL-1';
/** Explicit LEGACY override contains the gateway; unknown overrides fail startup. */
export function powerBIReleaseMode(override){
 return powerBIExportMode(override===undefined||override===null?POWERBI_RELEASE_MODE:override);
}
