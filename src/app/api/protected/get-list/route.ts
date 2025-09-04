import { respData, respErr } from "@/utils/resp";
import { getUserTasks } from "@/models/task";
import { TaskStatus } from "@/types/task";
import { NextRequest } from "next/server";
import { TaskVO } from "@/lib/client-api/types/TaskVO";
import { getCurrentUser } from "@/utils/user";
import { taskGetStepItem } from "@/lib/podcast/task";
import { LongTextOutput, PodcastStep } from "@/lib/podcast/types";
import { LongTextResult } from "@/queue/types";
import { getTaskStatusHuman } from "@/utils/task";

export async function GET(req: NextRequest) {
    const { userId, userEmail } = await getCurrentUser()
    if (!userEmail) {
      return respErr("no auth");
    }

    // Get pagination parameters from URL
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '10');

    const now = new Date();
    const created_from = new Date(0);
    const { tasks, total } = await getUserTasks(userEmail, created_from, page, pageSize);
    
    const tasksVO: TaskVO[] = tasks.map(task => {
        let error = null
        if (task.status == TaskStatus.Failed) {
            const reason = task.statusReason as any
            if (reason?.detail) {
                error = reason.detail
            } else {
                error = reason?.msg
            }
        }
        let result: any = {}
        const audioItem = taskGetStepItem(task, PodcastStep.Audio)
        const longtextIem = taskGetStepItem(task, PodcastStep.LongText)
        if (audioItem) {
            result = audioItem.input as LongTextResult || {}
            result.audio_url = audioItem.output?.location as string
            result.duration = audioItem.output?.duration
        }
        if (longtextIem) {
            result.title = longtextIem.output?.title || ''
            result.outline = longtextIem.output?.outline || ''
            result.key_points = longtextIem.output?.key_points || []
            result.script = longtextIem.output?.script || []
        }
        return {
            uuid: task.uuid,
            user_id: task.userId,
            user_email: task.userEmail,
            status: task.status as TaskStatus,
            status_human: getTaskStatusHuman(task.status as TaskStatus, true),
            user_inputs: task.userInputs,
            result: result,
            created_at: task.createdAt,
            updated_at: task.updatedAt,
            error: error
        }
    });

    return respData({
        items: tasksVO,
        pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        }
    });
}