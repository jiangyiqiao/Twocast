import { respData, respErr } from "@/utils/resp";
import { getCurrentUser } from "@/utils/user";
import { getTaskByUuid } from "@/models/task";
import { taskGetStepItem, taskUpdateStepItem } from "@/lib/podcast/task";
import { PodcastStep } from "@/lib/podcast/types";
import { getAudioQueue } from "@/queue/audio_queue";
import { TaskStatus } from "@/types/task";
import { queryWrap } from "@/utils/db-util";
import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId, userEmail } = await getCurrentUser()
  if (!userEmail) {
    return respErr("no auth");
  }

  const formData = await req.formData()
  const taskUuid = formData.get('task_uuid') as string
  const platform = formData.get('platform') as string
  const voiceId_1 = formData.get('voice_id_1') as string
  const voiceId_2 = formData.get('voice_id_2') as string
  const language = formData.get('language') as string

  if (!taskUuid || !platform || !voiceId_1 || !voiceId_2) {
    return respErr("missing required parameters");
  }

  try {
    // 获取任务
    const task = await getTaskByUuid(taskUuid);
    if (!task) {
      return respErr("task not found");
    }

    // 验证任务属于当前用户
    if (task.userEmail !== userEmail) {
      return respErr("unauthorized");
    }

    // 从数据库中获取最新的LongText步骤输出数据
    const longTextItem = taskGetStepItem(task, PodcastStep.LongText);
    if (!longTextItem.output) {
      return respErr("LongText output not found");
    }

    const longTextOutput = longTextItem.output;
    const scripts = longTextOutput.script || [];
    const title = longTextOutput.title || '';
    const outline = longTextOutput.outline || '';
    const keyPoints = longTextOutput.key_points || '';

    console.log(`[gen-podcast] using latest script data:`, {
      taskUuid,
      scriptCount: scripts.length,
      title: title.substring(0, 50) + '...',
      outline: outline.substring(0, 50) + '...'
    });

    // 更新用户输入
    const userInputs = {
      ...task.userInputs,
      platform,
      voice_id_1: voiceId_1,
      voice_id_2: voiceId_2,
      language
    };

    // 更新Audio步骤的输入，使用最新的数据库数据
    taskUpdateStepItem(task, PodcastStep.Audio, {
      input: {
        title: title,
        outline: outline,
        key_points: keyPoints,
        script: scripts,
        script_length: scripts.length
      },
      updated_at: new Date()
    });

    // 更新任务状态和用户输入
    await queryWrap(getDb().update(tasksTable).set({
      userInputs,
      stepsDetail: task.stepsDetail,
      status: TaskStatus.Processing,
      updatedAt: new Date()
    }).where(eq(tasksTable.id, task.id)));

    // 添加到音频生成队列
    getAudioQueue().add('audio', { task: {
      ...task,
      userInputs
    }});

    return respData({ 
      message: "Podcast generation started",
      task_uuid: taskUuid,
      script_count: scripts.length
    });

  } catch (error) {
    console.error("Error in gen-podcast:", error);
    return respErr("internal server error");
  }
}
