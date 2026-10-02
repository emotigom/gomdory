import {
  parseEduPublishCapabilityKeyRing,
  type EduPublishCapabilityKeyRing,
} from "@/lib/edu/publish/commitCapability";
import {
  getRuntimeEnv,
  readEnvStringFrom,
  type RuntimeEnv,
} from "@/lib/server/runtimeEnv";

export type EduPublishCapabilityRuntimeKeyRingResult =
  | {
      mode: "available";
      keyRing: EduPublishCapabilityKeyRing;
    }
  | {
      mode: "configuration_unavailable";
    };

export function loadEduPublishCapabilityKeyRing(
  source: RuntimeEnv = getRuntimeEnv(),
): EduPublishCapabilityRuntimeKeyRingResult {
  try {
    const parsed = parseEduPublishCapabilityKeyRing({
      currentKid: readEnvStringFrom(source, "EDU_PUBLISH_CAPABILITY_SIGNING_KID_CURRENT"),
      currentKeyBase64Url: readEnvStringFrom(source, "EDU_PUBLISH_CAPABILITY_SIGNING_KEY_CURRENT"),
      previousKid: readEnvStringFrom(source, "EDU_PUBLISH_CAPABILITY_SIGNING_KID_PREVIOUS"),
      previousKeyBase64Url: readEnvStringFrom(source, "EDU_PUBLISH_CAPABILITY_SIGNING_KEY_PREVIOUS"),
    });

    return parsed.ok ? { mode: "available", keyRing: parsed.keyRing } : { mode: "configuration_unavailable" };
  } catch {
    return { mode: "configuration_unavailable" };
  }
}
