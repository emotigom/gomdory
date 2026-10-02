import { compileBlocksToIr, type StudioIrInstruction } from "./ir";
import { getLessonById } from "./lessons";
import type { CodingStudioAssessmentResult, CodingStudioProject, LessonId, StudioRuntimeState } from "./types";
import type { CodingStudioSubmissionEvidence } from "./submissionSchema";

function countInstruction(plan: StudioIrInstruction[], kind: StudioIrInstruction["kind"]): number {
  return plan.reduce((total, instruction) => {
    if (instruction.kind === kind) return total + 1;
    if (instruction.kind === "repeat" || instruction.kind === "if_sensor") {
      return total + countInstruction(instruction.children, kind);
    }
    return total;
  }, 0);
}

export function buildSubmissionEvidence(args: {
  lessonId: LessonId;
  project: CodingStudioProject;
  runtimeState: StudioRuntimeState;
  assessment: CodingStudioAssessmentResult;
}): CodingStudioSubmissionEvidence {
  const lesson = getLessonById(args.lessonId);
  const ir = compileBlocksToIr(args.project.blocks);
  const goalDistance = Number(Math.hypot(lesson.goal.x - args.runtimeState.x, lesson.goal.z - args.runtimeState.z).toFixed(3));

  return {
    outcome: args.assessment.completed ? "completed" : "attempted",
    runtime: {
      reachedGoal: args.runtimeState.reachedGoal,
      blocked: args.runtimeState.blocked,
      stepCount: args.runtimeState.stepCount,
      finalPosition: {
        x: Number(args.runtimeState.x.toFixed(3)),
        z: Number(args.runtimeState.z.toFixed(3)),
        heading: Number(args.runtimeState.heading.toFixed(2)),
      },
    },
    structure: {
      blockCount: args.project.blocks.length,
      irInstructionCount: ir.length,
      repeatCount: countInstruction(ir, "repeat"),
      turnCount: countInstruction(ir, "turn"),
      sensorCount: countInstruction(ir, "if_sensor"),
    },
    lessonSignal: {
      focus: lesson.assessmentFocus,
      successReason: args.assessment.completed ? args.assessment.summary : undefined,
      retryReason: args.assessment.completed ? undefined : args.assessment.retryHint,
    },
    scene: {
      goalDistance,
    },
  };
}
