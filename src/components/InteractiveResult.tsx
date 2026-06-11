import React, { useState, useEffect } from 'react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Zap, Cpu, Settings2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface InteractiveResultProps {
  content: string;
  onFollowUp?: (prompt: string) => void;
  isLoading?: boolean;
}

export default function InteractiveResult({ content, onFollowUp, isLoading }: InteractiveResultProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);



  useEffect(() => {
    if (!content) {
      setDisplayedContent('');
      return;
    }

    if (isLoading) {
      setDisplayedContent(content);
      return;
    }

    // Typewriter effect
    setIsTyping(true);
    let i = 0;
    setDisplayedContent('');
    
    // Smooth, fast reveal for better UX
    const intervalId = setInterval(() => {
      setDisplayedContent(content.slice(0, i));
      i += 3; // reveal 3 chars at a time
      if (i > content.length) {
        setDisplayedContent(content);
        setIsTyping(false);
        clearInterval(intervalId);
      }
    }, 10);

    return () => clearInterval(intervalId);
  }, [content, isLoading]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="prose prose-invert prose-sm md:prose-base max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : 'javascript';
              const codeString = String(children).replace(/\n$/, '');
              const blockId = Math.random().toString(36).substring(7);
              
              if (!inline) {
                return (
                  <div className="relative group rounded-xl overflow-hidden border border-white/10 my-6 bg-[#1E1E1E]">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                        </div>
                        <span className="text-[10px] text-slate-600 dark:text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider ml-2">
                          {language}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyCode(codeString, blockId)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-800 dark:text-slate-300 text-xs transition-colors"
                      >
                        {copiedCodeId === blockId ? (
                          <><Check className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-400">Copied</span></>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy</>
                        )}
                      </button>
                    </div>
                    <div className="p-4 overflow-x-auto text-sm">
                      <SyntaxHighlighter
                        {...props}
                        style={vscDarkPlus as any}
                        language={language}
                        PreTag="div"
                        customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                );
              }
              
              return (
                <code {...props} className="px-1.5 py-0.5 rounded-md bg-white/10 text-brand-600 dark:text-brand-300 font-mono text-[0.9em]">
                  {children}
                </code>
              );
            },
            h1: ({children}) => <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 mt-6 flex items-center gap-2"><span className="text-brand-500">#</span> {children}</h1>,
            h2: ({children}) => <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 mt-6 flex items-center gap-2"><span className="text-brand-600 dark:text-brand-400">##</span> {children}</h2>,
            h3: ({children}) => <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 mt-5">{children}</h3>,
            ul: ({children}) => <ul className="space-y-1.5 my-4 list-none pl-0">{children}</ul>,
            li: ({children}) => (
              <li className="flex items-start gap-2 relative pl-5">
                <span className="absolute left-0 top-[0.4em] w-1.5 h-1.5 rounded-full bg-brand-500/60"></span>
                <span className="text-slate-800 dark:text-slate-300 leading-relaxed">{children}</span>
              </li>
            ),
            p: ({children}) => <p className="text-slate-800 dark:text-slate-300 leading-relaxed my-3">{children}</p>,
            strong: ({children}) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
            blockquote: ({children}) => (
              <blockquote className="border-l-2 border-brand-500/50 bg-brand-500/5 py-2 px-4 rounded-r-lg my-4 italic text-slate-800 dark:text-slate-300">
                {children}
              </blockquote>
            )
          }}
        >
          {displayedContent}
        </ReactMarkdown>
        {isTyping && (
          <span className="inline-block w-2 h-4 ml-1 bg-brand-500 animate-pulse align-middle rounded-sm"></span>
        )}
      </motion.div>


    </div>
  );
}
