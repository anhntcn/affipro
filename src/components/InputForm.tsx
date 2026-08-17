import React from 'react';
import { useForm } from 'react-hook-form';
import { useStore } from '../store/useStore';
import { Loader2, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FormData {
  productInfo: string;
  affiliateLink: string;
}

export const InputForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const { generateContent, isLoading } = useStore();

  const onSubmit = (data: FormData) => {
    generateContent(data.productInfo, data.affiliateLink);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          Nhập thông tin sản phẩm
        </h2>
        <p className="text-gray-500 text-sm mt-1">Cung cấp chi tiết sản phẩm và link affiliate để AI tự động lên bài.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="productInfo" className="block text-sm font-medium text-gray-700 mb-1">
            Thông tin sản phẩm thô <span className="text-red-500">*</span>
          </label>
          <textarea
            id="productInfo"
            rows={5}
            placeholder="Ví dụ: Nồi chiên không dầu Cosori 5.5L, công nghệ Air Crisp, giảm 85% mỡ, bảo hành 2 năm..."
            className={cn(
              "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              errors.productInfo && "border-red-500 focus:border-red-500 focus:ring-red-500"
            )}
            {...register("productInfo", { required: "Vui lòng nhập thông tin sản phẩm" })}
          />
          {errors.productInfo && (
            <p className="mt-1 text-sm text-red-500">{errors.productInfo.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="affiliateLink" className="block text-sm font-medium text-gray-700 mb-1">
            Link Affiliate (Shopee, TikTok Shop, Lazada...) <span className="text-red-500">*</span>
          </label>
          <input
            id="affiliateLink"
            type="url"
            placeholder="https://shope.ee/..."
            className={cn(
              "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              errors.affiliateLink && "border-red-500 focus:border-red-500 focus:ring-red-500"
            )}
            {...register("affiliateLink", { 
              required: "Vui lòng nhập link affiliate",
              pattern: {
                value: /^https?:\/\/.+/,
                message: "Vui lòng nhập URL hợp lệ (bắt đầu bằng http hoặc https)"
              }
            })}
          />
          {errors.affiliateLink && (
            <p className="mt-1 text-sm text-red-500">{errors.affiliateLink.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang phân tích và viết bài...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Tạo Nội Dung Đa Kênh
            </>
          )}
        </button>
      </form>
    </div>
  );
};
