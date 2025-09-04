import { respData, respErr, respErrCode } from "@/utils/resp";

import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { NewTask } from "@/db/types";
import { taskSetStepItem } from "@/lib/podcast/task";
import { PodcastInputType, PodcastStep } from "@/lib/podcast/types";
import { genTaskId } from '@/models/task';
import { getLinkQueue } from "@/queue/link_queue";
import { getLongTextQueue } from "@/queue/long_text_queue";
import { getTopicQueue } from "@/queue/topic_queue";
import { TaskStatus } from "@/types/task";
import { queryWrap } from "@/utils/db-util";
import { getCurrentUser } from "@/utils/user";
import axios from "axios";
import { Buffer } from "buffer";
import { getFrontPageQueue } from "@/queue/front_page_queue";

export async function POST(req: Request) {
  const { userId, userEmail } = await getCurrentUser()
  if (!userEmail) {
    return respErr("no auth");
  }

  const formData = await req.formData()
  const type = formData.get('type')
  let text = formData.get('text')
  const file = formData.get('file')
  const language = formData.get('language')
  if (type === PodcastInputType.File && file) {
    text = await extractTextFromTextract(file as unknown as File)
    text = text.replace(/\n[\n]+/g, '\n').trim()
  } else if (text && typeof text === 'string') {
    text = text.trim()
    if (text.length > 100_000) {
      return respErr("invalid params: text is too long");
    }
  }
  if (!text) {
    return respErr("invalid params: text is empty");
  }

  // check credits
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  // check if there is a pending task
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  const task: NewTask = {
    userId: userId,
    uuid: genTaskId(),
    userEmail: userEmail,
    userInputs: {
      type: type as PodcastInputType,
      text: text as string,
      language: language as string,
    },
    status: TaskStatus.Pending,
    consumedCredits: 0,
    createdAt: new Date(),
  }

  // 设置队列参数
  switch (type) {
    case PodcastInputType.Topic:
      taskSetStepItem(task, PodcastStep.Topic, {
        input: text,
      })
      break
    case PodcastInputType.Link:
      taskSetStepItem(task, PodcastStep.Link, {
        input: text,
      })
      break
    case PodcastInputType.File:
    case PodcastInputType.LongText:
      taskSetStepItem(task, PodcastStep.LongText, {
        input: text,
      })
      break
    case PodcastInputType.FrontPage:
      taskSetStepItem(task, PodcastStep.FrontPage, {
        input: text,
      })
      break
  }

  // save to db
  task.id = (await queryWrap(getDb().insert(tasksTable).values(task).returning({ id: tasksTable.id })))[0].id!
  
  // 传给队列 - 只生成脚本，不进入音频生成
  switch (type) {
    case PodcastInputType.Topic:
      getTopicQueue().add('topic', { task: task })
      break
    case PodcastInputType.Link:
      getLinkQueue().add('link', { task: task })
      break
    case PodcastInputType.File:
    case PodcastInputType.LongText:
      getLongTextQueue().add('long_text', { task: task })
      break
    case PodcastInputType.FrontPage:
      getFrontPageQueue().add('front_page', { task: task })
      break
  }

  return respData(task);
}

async function extractTextFromTextract(file: File): Promise<string> {
  // 1. 获取文件名和类型
  const name = file.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  // 2. 读取文件内容为 Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // 3. 转为 base64
  const base64String = buffer.toString('base64');

  // 4. 构造请求体
  const data = {
    data: base64String,
    file_type: ext,
  };

  // 5. 发送 POST 请求
  try {
    const resp = await axios.post(process.env.SERVICE_TEXTRACT_API!, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60s 超时
    });
    if (resp.data && typeof resp.data.text === 'string') {
      return resp.data.text;
    } else {
      throw new Error('Textract API 响应无效');
    }
  } catch (err: any) {
    throw new Error('Textract API 调用失败: ' + (err?.message || err));
  }
}