import React from 'react';
import { useUISettings } from '../hooks/useUISettings';
import { ARTICLES } from '../utils/articles';

const LEADING_ARTICLE = /^(\s*)(der|die|das)(\s+)(\S[\s\S]*)$/i;

/** An article (der / die / das) in the colour of its gender — the same colours as the articles trainer buttons. */
export const ArticleWord: React.FC<{ article: string }> = ({ article }) => {
  const [settings] = useUISettings();
  const kind = article.toLowerCase();
  if (!settings.highlightArticles || !(ARTICLES as readonly string[]).includes(kind)) return <>{article}</>;
  return <span className={`article-word article-word--${kind}`}>{article}</span>;
};

/** German text whose leading article (if any) is highlighted; the highlight can be switched off in the settings. */
export const ArticleText: React.FC<{ text: string }> = ({ text }) => {
  const match = LEADING_ARTICLE.exec(text);
  if (!match) return <>{text}</>;
  const [, lead, article, gap, rest] = match;
  return (
    <>
      {lead}
      <ArticleWord article={article} />
      {gap}
      {rest}
    </>
  );
};
