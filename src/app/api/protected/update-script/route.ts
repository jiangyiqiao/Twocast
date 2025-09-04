import { respData, respErr } from "@/utils/resp";
import { NextRequest } from 'next/server';
import { getDb } from '@/db/db';
import { tasksTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from "@/utils/user";
import { queryWrap } from "@/utils/db-util";
import { taskGetStepItem, taskUpdateStepItem } from "@/lib/podcast/task";
import { PodcastStep } from "@/lib/podcast/types";

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail } = await getCurrentUser()
    if (!userEmail) {
      return respErr("no auth");
    }

    const body = await request.json()
    const { taskUuid, scripts } = body

    if (!taskUuid || !scripts) {
      return respErr("invalid params: taskUuid and scripts are required");
    }

    // 查询db中的task
    const tasks = await queryWrap(getDb().select().from(tasksTable).where(eq(tasksTable.uuid, taskUuid)))
    
    if (!tasks || tasks.length === 0) {
      return respErr("task not found");
    }

    const task = tasks[0];

    // 验证任务属于当前用户
    if (task.userEmail !== userEmail) {
      return respErr("unauthorized");
    }

    // 使用taskUpdateStepItem安全地更新LongText步骤的输出
    const longTextItem = taskGetStepItem(task, PodcastStep.LongText);
    

    // 如果LongText步骤不存在，创建一个新的
    if (!longTextItem.output) {
      taskUpdateStepItem(task, PodcastStep.LongText, {
        output: {
          title: '',
          outline: '',
          key_points: '',
          script: scripts,
          script_length: scripts.length
        },
        updated_at: new Date()
      });
    } else {
      // 更新现有的输出
      taskUpdateStepItem(task, PodcastStep.LongText, {
        output: {
          ...longTextItem.output,
          script: scripts,
          script_length: scripts.length
        },
        updated_at: new Date()
      });
    }

    // 使用taskUpdateStepItem安全地更新audio步骤的输入script为scripts
    const audioItem = taskGetStepItem(task, PodcastStep.Audio);
    if (audioItem.input) {
      taskUpdateStepItem(task, PodcastStep.Audio, {
        input: {
          ...audioItem.input,
          script: scripts
        },
        updated_at: new Date()
      });
    }


    // 更新db中的task
    await queryWrap(getDb().update(tasksTable).set({
      stepsDetail: task.stepsDetail,
      updatedAt: new Date()
    }).where(eq(tasksTable.uuid, taskUuid)))

    console.log(`[update-script] successfully updated script for task ${taskUuid}`);

    return respData("success");

  } catch (error) {
    console.error('Error updating script:', error);
    return respErr("internal server error");
  }
} 