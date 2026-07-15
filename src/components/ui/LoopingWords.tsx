import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { cn } from '../../lib/utils';

type LoopingWordsProps = {
  words: string[];
  className?: string;
  textClassName?: string;
};

export function LoopingWords({ words, className, textClassName }: LoopingWordsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const selectorRef = useRef<HTMLDivElement | null>(null);

  const normalizedWords = useMemo(() => {
    const cleaned = words.map((w) => w.trim()).filter(Boolean);
    if (cleaned.length === 0) return ['Maximize Your Earnings.'];
    if (cleaned.length === 1) return [cleaned[0], cleaned[0], cleaned[0]];
    return cleaned;
  }, [words]);

  useEffect(() => {
    const root = rootRef.current;
    const wordList = listRef.current;
    const selector = selectorRef.current;

    if (!root || !wordList || !selector) return;
    if (normalizedWords.length < 2) return;

    const ctx = gsap.context(() => {
      const getItems = () => Array.from(wordList.children) as HTMLLIElement[];

      let items = getItems();
      let currentIndex = 0;
      const totalWords = items.length;
      const wordHeightPercent = 100 / totalWords;

      const updateSelectorWidth = () => {
        items = getItems();
        if (items.length === 0) return;

        const centerIndex = (currentIndex + 1) % items.length;
        const centerWord = items[centerIndex];

        const centerWordWidth = centerWord.getBoundingClientRect().width;
        const listWidth = wordList.getBoundingClientRect().width || centerWordWidth;
        const percentageWidth = (centerWordWidth / listWidth) * 100;

        gsap.to(selector, {
          width: `${Math.max(35, Math.min(percentageWidth, 100))}%`,
          duration: 0.45,
          ease: 'expo.out',
        });
      };

      const moveWords = () => {
        currentIndex += 1;

        gsap.to(wordList, {
          yPercent: -wordHeightPercent * currentIndex,
          duration: 1.1,
          ease: 'elastic.out(1, 0.85)',
          onStart: updateSelectorWidth,
          onComplete: () => {
            if (currentIndex >= totalWords - 3) {
              wordList.appendChild(wordList.children[0]);
              currentIndex -= 1;
              gsap.set(wordList, { yPercent: -wordHeightPercent * currentIndex });
            }
          },
        });
      };

      updateSelectorWidth();

      const loopTimeline = gsap.timeline({ repeat: -1, delay: 0.9 });
      loopTimeline.call(moveWords).to({}, { duration: 1.8 });

      const onResize = () => updateSelectorWidth();
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('resize', onResize);
        loopTimeline.kill();
      };
    }, root);

    return () => ctx.revert();
  }, [normalizedWords]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative mx-auto inline-flex h-[1.4em] w-full max-w-[34ch] items-center justify-center sm:h-[1.2em]',
        className,
      )}
      aria-live="polite"
      aria-label="Animated highlight"
    >
      <div className="relative h-full w-full overflow-hidden px-1">
        <ul
          ref={listRef}
          className="m-0 flex list-none flex-col items-center p-0 text-center will-change-transform"
        >
          {normalizedWords.map((word, index) => (
            <li
              key={`${word}-${index}`}
              className="flex h-[1.4em] w-full items-center justify-center whitespace-nowrap sm:h-[1.2em]"
            >
              <span
                className={cn('block leading-none text-[0.68em] sm:text-[0.82em] lg:text-[1em]', textClassName)}
              >
                {word}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy-950 via-transparent to-navy-950/90" />

      <div
        ref={selectorRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[1.2em] min-w-[7ch] -translate-x-1/2 -translate-y-1/2 sm:h-[1.05em]"
        style={{ width: '58%' }}
        aria-hidden="true"
      >
        <span className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-white" />
        <span className="absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-white" />
        <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-white" />
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-white" />
      </div>
    </div>
  );
}
