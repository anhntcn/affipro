import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { GeneratedContent } from '../types';
import { 
  Facebook, 
  Video, 
  MessageCircle, 
  BarChart3, 
  Copy, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { cn } from './InputForm';

type Tab = 'analysis' | 'facebook' | 'video' | 'telegram';

export const ResultDisplay: React.FC = () => {
  const { generatedContent, reset } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('facebook');
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  if (!generatedContent) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates({ ...copiedStates, [id]: true });
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const tabs = [
    { id: 'facebook', label: 'Facebook / Threads', icon: Facebook },
    { id: 'video', label: 'Kịch Bản Video', icon: Video },
    { id: 'telegram', label: 'Tin Nhắn Zalo/Tele', icon: MessageCircle },
    { id: 'analysis', label: 'Phân Tích SP', icon: BarChart3 },
  ] as const;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Header & Tabs */}
      <div className="bg-gray-50 border-b border-gray-100 p-4 sm:p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Kết Quả Nội Dung</h2>
          <button 
            onClick={reset}
            className="text-gray-500 hover:text-gray-900 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Làm lại
          </button>
        </div>
        
        <div className="flex space-x-1 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium text-sm whitespace-nowrap transition-colors",
                activeTab === tab.id 
                  ? "bg-white text-blue-600 border-t border-l border-r border-gray-100 shadow-[0_-2px_4px_rgba(0,0,0,0.02)] relative top-[1px]" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 sm:p-8 flex-1 bg-white">
        {activeTab === 'analysis' && <AnalysisTab data={generatedContent.product_analysis} />}
        {activeTab === 'facebook' && <FacebookTab data={generatedContent.facebook_threads} onCopy={handleCopy} copied={copiedStates['fb']} />}
        {activeTab === 'video' && <VideoTab data={generatedContent.short_video_script} />}
        {activeTab === 'telegram' && <TelegramTab data={generatedContent.instant_deal_telegram_zalo} onCopy={handleCopy} copied={copiedStates['tele']} />}
      </div>
    </div>
  );
};

// Sub-components for tabs
const CopyButton = ({ onClick, copied }: { onClick: () => void, copied: boolean }) => (
  <button
    onClick={onClick}
    className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 shadow-sm transition-all hover:shadow"
    title="Copy nội dung"
  >
    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
  </button>
);

const AnalysisTab = ({ data }: { data: GeneratedContent['product_analysis'] }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Tên sản phẩm</h3>
      <p className="text-gray-900 font-medium text-lg">{data.product_name}</p>
    </div>
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Khách hàng mục tiêu</h3>
      <p className="text-gray-700">{data.target_audience}</p>
    </div>
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Lợi ích cốt lõi (USPs)</h3>
      <ul className="space-y-2">
        {data.key_benefits.map((benefit, idx) => (
          <li key={idx} className="flex items-start gap-2 text-gray-700">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const FacebookTab = ({ data, onCopy, copied }: { data: GeneratedContent['facebook_threads'], onCopy: (text: string, id: string) => void, copied: boolean }) => {
  const contentString = `${data.hook_headline}\n\n${data.story_or_problem}\n\n👉 Điểm nổi bật:\n${data.product_highlights.map(h => `- ${h}`).join('\n')}\n\n${data.call_to_action}\n\n${data.hashtags.join(' ')}`;
  
  return (
    <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-gray-50 rounded-xl p-5 font-sans whitespace-pre-wrap text-gray-800 text-[15px] leading-relaxed border border-gray-100">
        <p className="font-bold text-lg mb-4">{data.hook_headline}</p>
        <p className="mb-4">{data.story_or_problem}</p>
        <div className="mb-4">
          <p className="font-medium mb-2">👉 Điểm nổi bật:</p>
          <ul className="space-y-1">
            {data.product_highlights.map((highlight, idx) => (
              <li key={idx}>- {highlight}</li>
            ))}
          </ul>
        </div>
        <p className="font-medium mb-4 text-blue-700">{data.call_to_action}</p>
        <p className="text-blue-600 text-sm">{data.hashtags.join(' ')}</p>
      </div>
      <CopyButton onClick={() => onCopy(contentString, 'fb')} copied={copied} />
    </div>
  );
};

const VideoTab = ({ data }: { data: GeneratedContent['short_video_script'] }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Tiêu đề ý tưởng</h3>
        <p className="font-bold text-gray-900">{data.video_title}</p>
      </div>
      <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
        ⏱ {data.estimated_duration}
      </div>
    </div>
    
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Kịch bản chi tiết</h3>
      {data.scenes.map((scene) => (
        <div key={scene.scene_number} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-blue-100 text-blue-700 font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs">
              {scene.scene_number}
            </span>
            <span className="text-sm font-medium text-gray-500">{scene.time_range}</span>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">🎬 Hình ảnh / Hành động</p>
              <p className="text-sm text-gray-800">{scene.visual_action}</p>
            </div>
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">🎙️ Lời thoại</p>
              <p className="text-sm text-gray-800 italic">"{scene.voiceover}"</p>
            </div>
          </div>
          
          {scene.on_screen_text && (
            <div className="mt-3 text-sm flex items-start gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase mt-0.5">📝 Text nổi:</span>
              <span className="font-medium text-gray-800 bg-yellow-100 px-2 py-0.5 rounded text-xs">{scene.on_screen_text}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

const TelegramTab = ({ data, onCopy, copied }: { data: string, onCopy: (text: string, id: string) => void, copied: boolean }) => (
  <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="bg-[#EBF4FF] border border-[#D1E5FF] rounded-2xl p-5 pr-14 whitespace-pre-wrap text-[#1A202C] text-[15px] font-sans leading-relaxed">
      {data}
    </div>
    <CopyButton onClick={() => onCopy(data, 'tele')} copied={copied} />
  </div>
);
