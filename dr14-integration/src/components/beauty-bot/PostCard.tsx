import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ThreadsPost } from '@/types/beauty-bot';

interface Props {
  post: ThreadsPost;
  dayLabel?: string;
}

export function PostCard({ post, dayLabel }: Props) {
  return (
    <Card className="border-purple-100 shadow-sm">
      <CardContent className="pt-4 space-y-3">
        {/* Meta */}
        <div className="flex flex-wrap gap-2 items-center">
          {dayLabel && <Badge className="bg-purple-100 text-purple-700 border-0">{dayLabel}</Badge>}
          <Badge variant="outline" className="text-pink-700 border-pink-200 text-xs">🏷️ {post.topic}</Badge>
          <Badge variant="outline" className="text-indigo-700 border-indigo-200 text-xs">📋 {post.format}</Badge>
          <Badge variant="outline" className="text-gray-600 border-gray-200 text-xs">⏰ {post.best_post_time}</Badge>
          <Badge variant="outline" className="text-emerald-700 border-emerald-200 text-xs">📈 {post.estimated_reach}</Badge>
        </div>

        {/* Title */}
        <div className="font-semibold text-purple-900 text-base leading-snug">
          💬 {post.title}
        </div>

        {/* Body */}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {post.body}
        </div>

        {/* Engagement Question */}
        {post.engagement_question && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800">
            💡 {post.engagement_question}
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.map(tag => (
              <span
                key={tag}
                className="bg-purple-50 text-purple-700 rounded-full px-2 py-0.5 text-xs border border-purple-100"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        {post.cta && (
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-400 rounded-r-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
            {post.cta}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
