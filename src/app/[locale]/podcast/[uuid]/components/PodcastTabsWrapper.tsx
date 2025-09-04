'use client';

import { useState, useCallback } from 'react';
import { ScriptItem } from '@/lib/podcast/types';
import { toast } from 'sonner';
import PodcastTabs from './PodcastTabs';

interface PodcastTabsWrapperProps {
  outline: string;
  keyPoints: string;
  scripts: ScriptItem[];
  taskUuid: string;
}

export default function PodcastTabsWrapper({ outline, keyPoints, scripts: initialScripts, taskUuid }: PodcastTabsWrapperProps) {
  const [scripts, setScripts] = useState<ScriptItem[]>(initialScripts);
  const [saving, setSaving] = useState(false);
  const [lastSavedScripts, setLastSavedScripts] = useState<ScriptItem[]>(initialScripts);

  // 优化：使用 useCallback 避免不必要的重新渲染
  const handleScriptsUpdate = useCallback(async (updatedScripts: ScriptItem[]) => {
    // 检查是否有实际变化
    const hasChanges = JSON.stringify(updatedScripts) !== JSON.stringify(lastSavedScripts);
    if (!hasChanges) {
      setScripts(updatedScripts);
      return;
    }

    setScripts(updatedScripts);
    setSaving(true);
    
    try {
      const response = await fetch('/api/protected/update-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskUuid,
          scripts: updatedScripts,
        }),
      });

      if (response.ok) {
        setLastSavedScripts(updatedScripts);
        toast.success('脚本已保存');
      } else {
        const error = await response.json();
        toast.error('保存失败: ' + (error.error || '未知错误'));
        // 恢复到最后保存的状态
        setScripts(lastSavedScripts);
      }
    } catch (error) {
      console.error('Error saving scripts:', error);
      toast.error('保存失败，请重试');
      // 恢复到最后保存的状态
      setScripts(lastSavedScripts);
    } finally {
      setSaving(false);
    }
  }, [taskUuid, lastSavedScripts]);

  return (
    <PodcastTabs
      outline={outline}
      keyPoints={keyPoints}
      scripts={scripts}
      onScriptsUpdate={handleScriptsUpdate}
      saving={saving}
      taskUuid={taskUuid}
    />
  );
} 