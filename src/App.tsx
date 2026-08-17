/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputForm } from './components/InputForm';
import { ResultDisplay } from './components/ResultDisplay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sparkles } from 'lucide-react';
import { useStore } from './store/useStore';

export default function App() {
  const { generatedContent, error } = useStore();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              Affiliate Content Pro
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Input Form */}
          <div className="lg:col-span-4 sticky top-24">
            <InputForm />
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                <p className="font-semibold">Lỗi tạo nội dung:</p>
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8">
            {!generatedContent ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 h-[400px] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có nội dung nào</h3>
                <p className="max-w-sm">Hãy nhập thông tin sản phẩm và link affiliate ở cột bên trái để AI tự động lên bài đăng đa kênh cho bạn.</p>
              </div>
            ) : (
              <ErrorBoundary>
                <ResultDisplay />
              </ErrorBoundary>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
