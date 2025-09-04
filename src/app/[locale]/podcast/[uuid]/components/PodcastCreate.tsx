'use client';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { OptionItem, TcSelector } from '@/components/podcast/TcSelector';
import { Platform, ScriptItem } from '@/lib/podcast/types';
import { useTranslation } from 'react-i18next';
import { languages as minimaxLng } from '@/lib/podcast/languages/minimax';
import { languages as geminiLng } from "@/lib/podcast/languages/gemini";
import { languages as fishAudioLng } from "@/lib/podcast/languages/fish_audio";
import { apiRequest } from '@/lib/client-api/base';
import { toast } from 'sonner';
import { VoicePlayerButton } from '@/components/podcast/VoicePlayerButton';
import { getPlatformDefaultVoices } from '@/lib/podcast/client_utils';
import { Task } from '@/db/types';
enum SelectType {
  Select = 'select',
  Input = 'input',
}
interface PodcastCreateProps {
  task: Task;
}
export default function PodcastCreate({task}: PodcastCreateProps) {
  // 音频选择相关状态
  const [platform, setPlatform] = useState(Platform.FishAudio.toString());
  const [voiceId_1, setVoiceId_1] = useState('');
  const [voiceId_2, setVoiceId_2] = useState('');
  const [outputLanguage, setOutputLanguage] = useState('auto');
  const [voices, setVoices] = useState({});
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [selectType, setSelectType] = useState(SelectType.Select);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const {t, i18n} = useTranslation('podcast');
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [loading, setLoading] = useState(false);

  const platforms: OptionItem[] = [
    { id: Platform.Minimax, label: 'Minimax', icon: '🤖' },
    { id: Platform.Gemini, label: 'Gemini', icon: '🤖' },
    { id: Platform.FishAudio, label: 'Fish Audio', icon: '🐟' },
    { id: Platform.FishAudio + '_custom', label: 'Fish Audio (Custom)', icon: '🐟' },
  ]
  const lngOpt2OptionItem = (lngs: any[]) => {
    const audoOpt = [{
      id: 'auto',
      label: t('auto'),
      icon: '',
      description: t('depends_on_source_language')
    }]
    return [...audoOpt, ...lngs.map(l => ({
      id: l.code,
      label: l.label,
      icon: ''
    }))]
  }
  const languages = {
    [Platform.Minimax]: lngOpt2OptionItem(minimaxLng),
    [Platform.Gemini]: lngOpt2OptionItem(geminiLng),
    [Platform.FishAudio]: lngOpt2OptionItem(fishAudioLng),
    [Platform.FishAudio + '_custom']: lngOpt2OptionItem(fishAudioLng),
  }
  const platformTips = {
    [Platform.Minimax]: 'https://platform.minimaxi.com/examination-center/voice-experience-center/t2a_v2',
  }
  // 获取语音数据
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const resp = await apiRequest({
          url: '/api/voices',
          method: 'GET',
        });
        console.log('Fetched voices:', resp.data.data);
        setVoices(resp.data.data);
      } catch (error) {
        console.error('Failed to fetch voices:', error);
      }
    };
    fetchVoices();
  }, []);
  useEffect(() => {
    if (platform) {
      console.log('Platform changed to:', platform);
      console.log('Available voices:', voices);
      
      if (platform.includes('custom')) {
        setSelectType(SelectType.Input);
      } else {
        setSelectType(SelectType.Select);
        if (voices[platform]) {
          console.log('Setting voice options for platform:', platform, voices[platform]);
          setVoiceOptions(voices[platform].map(v => ({
            id: v.id,
            label: v.name,
            icon: v.icon,
            render: (option: OptionItem) => (
              <VoicePlayerButton
                id={v.id}
                sample={v.sample}
                label={option.label}
                playingVoiceId={playingVoiceId}
                setPlayingVoiceId={setPlayingVoiceId}
                audioRefs={audioRefs}
              />
            )
          })));
        } else {
          console.log('No voices found for platform:', platform);
          setVoiceOptions([]);
        }
      }
      // 设置默认语音
      const platformDefaultVoices = getPlatformDefaultVoices(i18n.language);
      console.log('Default voices for platform:', platform, platformDefaultVoices[platform as Platform]);
      if (platformDefaultVoices[platform as Platform]) {
        setVoiceId_1(platformDefaultVoices[platform as Platform].voiceId_1);
        setVoiceId_2(platformDefaultVoices[platform as Platform].voiceId_2);
      }
    }
  }, [platform, voices, playingVoiceId, i18n.language]);
  // 检查是否可以提交
  useEffect(() => {
    const isReadyToSubmit = () => {
      console.log('platform', platform)
      console.log('voiceId_1', voiceId_1)
      console.log('voiceId_2', voiceId_2)
      return platform && voiceId_1 && voiceId_2;
    };
    setReadyToSubmit(isReadyToSubmit());
  }, [platform, voiceId_1, voiceId_2]);
  useEffect(() => {
    // 当 platform 或 voices 变化时，重置播放状态
    console.log('Platform/voices changed, resetting playingVoiceId. Platform:', platform, 'Voices keys:', Object.keys(voices));
    setPlayingVoiceId(null);
    // 暂停所有 audio
    Object.values(audioRefs.current).forEach((audio: HTMLAudioElement | null) => {
      if (audio && typeof audio.pause === 'function') {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }, [platform, voices]);
  const handleCreatePodcast = async () => {
    console.log("readyToSubmit", readyToSubmit)
    console.log("loading", loading)
    if (!readyToSubmit) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("task_uuid", task.uuid);
      formData.append("platform", platform);
      formData.append("voice_id_1", voiceId_1);
      formData.append("voice_id_2", voiceId_2);
      formData.append("language", outputLanguage);
      await apiRequest({
        url: "/api/protected/gen-podcast",
        method: "POST",
        data: formData,
      });
      toast.success("Task submitted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create podcast");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      {/* 音频选择模块 */}
      <div className="mt-8 p-6 bg-gradient-to-r from-indigo-50/80 to-purple-50/60 dark:from-indigo-900/40 dark:to-purple-900/30 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/50">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            🎙️ Create Podcast
        </h4>
        {/* 音频选择器 */}
        {/* Bottom Section with Speed Selector and Create Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <TcSelector value={platform} onChange={(v) => {
            setPlatform(v);
            if (v.includes('custom')) {
              setVoiceId_1('');
              setVoiceId_2('');
            }
          }} options={platforms} title={t('platform')} />
          {selectType == SelectType.Select && <TcSelector value={voiceId_1} onChange={setVoiceId_1} options={voiceOptions} title={t('voice_1')} />}
          {selectType == SelectType.Select && <TcSelector value={voiceId_2} onChange={setVoiceId_2} options={voiceOptions} title={t('voice_2')} />}
          {selectType == SelectType.Input && <input type="text" value={voiceId_1} onChange={(e) => setVoiceId_1(e.target.value)} placeholder="Voice id" className="w-full sm:w-32 px-3 sm:px-4 py-2 sm:py-3 text-sm bg-gradient-to-br from-white/90 to-white/60 dark:from-gray-800/90 dark:to-gray-900/60 backdrop-blur-sm border-0 rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none" style={{ boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)' }} />}
          {selectType == SelectType.Input && <input type="text" value={voiceId_2} onChange={(e) => setVoiceId_2(e.target.value)} placeholder="Voice id" className="w-full sm:w-32 px-3 sm:px-4 py-2 sm:py-3 text-sm bg-gradient-to-br from-white/90 to-white/60 dark:from-gray-800/90 dark:to-gray-900/60 backdrop-blur-sm border-0 rounded-lg sm:rounded-xl focus:outline-none focus:ring-0 text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none" style={{ boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.4)' }} />}
          <TcSelector value={outputLanguage} onChange={setOutputLanguage} options={languages[platform as Platform]} title={t('podcast_language')} />
          {/* Create Button */}
          <button
            onClick={handleCreatePodcast}
            disabled={!readyToSubmit || loading}
            className="flex items-center justify-center gap-2 px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-gray-900 via-pink-900 to-indigo-900 dark:from-white dark:via-pink-100 dark:to-indigo-100 text-white dark:text-gray-900 rounded-lg sm:rounded-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 font-semibold shadow-lg relative overflow-hidden flex-1 sm:flex-initial"
            style={{
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white dark:text-gray-900 relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span className="text-xs sm:text-sm font-bold relative z-10 ml-2">{t('create_button_loading')}</span>
              </>
            ) : (
              <>
                <span className="text-xs sm:text-sm font-bold relative z-10 flex items-center gap-1">
                  {t('create_button')}
                </span>
              </>
            )}
          </button>
        </div>
        {/* platform tips */}   
        {platformTips[platform as Platform] && (
          <div className="mt-4 sm:mt-5">
            <a
              href={platformTips[platform as Platform]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm bg-gradient-to-r from-indigo-50/80 to-purple-50/60 dark:from-indigo-900/40 dark:to-purple-900/30 rounded-lg sm:rounded-xl hover:scale-[1.02] transition-all duration-300 text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 relative overflow-hidden"
              style={{
                boxShadow: 'inset 0 2px 10px rgba(99, 102, 241, 0.1), 0 4px 20px rgba(99, 102, 241, 0.05)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none rounded-lg sm:rounded-xl"></div>
              <span className="relative z-10">🔗</span>
              <span className="relative z-10 font-medium">
                {t('more_voices_about', { platform: platforms.find(p => p.id == platform)?.label })}
              </span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}