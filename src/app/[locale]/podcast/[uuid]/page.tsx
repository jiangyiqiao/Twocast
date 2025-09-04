import { getTaskByUuid } from '@/models/task';
import { taskGetStepItem } from '@/lib/podcast/task';
import { AudioOutput, PodcastStep } from '@/lib/podcast/types';
import { LongTextOutput } from '@/lib/podcast/types';
import PodcastPlayer from './components/PodcastPlayer';
import PodcastCreate from './components/PodcastCreate';
import PodcastTabsWrapper from './components/PodcastTabsWrapper';

interface PodcastPageProps {
  params: {
    uuid: string;
    locale: string;
  };
}

export default async function PodcastPage({ params }: PodcastPageProps) {
  // 使用 server action 查询 uuid 获取 task
  const task = await getTaskByUuid(params.uuid);
  
  if (!task) {
    // 使用简单的重定向而不是notFound
    return <div>Task not found</div>;
  }

  // 获取音频详细信息
  const audioItem = taskGetStepItem(task, PodcastStep.Audio);
  const longTextItem = taskGetStepItem(task, PodcastStep.LongText);
  
  if (!audioItem || !longTextItem) {
    return <div>Task data not found</div>;
  }

  // 安全地获取数据，提供默认值
  const longTextData = longTextItem.output as LongTextOutput || {};
  const audioOutput = audioItem.output as AudioOutput || {};

  // 确保必要字段存在
  const title = longTextData.title || 'Untitled Podcast';
  const outline = longTextData.outline || '';
  const keyPoints = Array.isArray(longTextData.key_points) ? longTextData.key_points.join('\n') : '';
  const scripts = longTextData.script || [];
  const audioUrl = audioOutput.location || '';
  const duration = audioOutput.duration || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20">
      {/* 背景装饰光晕 */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-tr from-blue-400/20 to-cyan-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* 页面标题 */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">
            {title}
          </h1>
        </div>

        {/* 播放器区域 */}
        <div className="max-w-4xl mx-auto mb-8 sm:mb-12">
          <PodcastPlayer audioUrl={audioUrl} title={title} duration={duration} />
        </div>
        
        {/* 创建播客 */}
        <div className="max-w-4xl mx-auto">
          <PodcastCreate 
            task={task}
          />
        </div>
        
        {/* 内容标签页 */}
        <div className="max-w-4xl mx-auto">
          <PodcastTabsWrapper 
            outline={outline}
            keyPoints={keyPoints}
            scripts={scripts}
            taskUuid={params.uuid}
          />
        </div>
      </div>
    </div>
  );
}
