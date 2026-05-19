import React, { useEffect, useRef, useState } from 'react';
import { ModrinthProject } from '../types';
import { Download, ChevronRight, Globe, Lock, Archive, Clock, Heart, MoreVertical, ExternalLink, Copy, Star } from 'lucide-react';

interface ProjectCardProps {
  project: ModrinthProject;
  onClick: (id: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  showFavoriteAction?: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, isFavorite = false, onToggleFavorite, showFavoriteAction = true }) => {
  const summary = (project.description || '').trim() || 'No summary available';

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved': return { color: 'text-modrinth-green border-modrinth-green bg-modrinth-green/10', icon: Globe, label: 'Approved' };
      case 'draft': return { color: 'text-yellow-500 border-yellow-500 bg-yellow-500/10', icon: Lock, label: 'Draft' };
      case 'rejected': return { color: 'text-red-500 border-red-500 bg-red-500/10', icon: Lock, label: 'Rejected' };
      case 'archived': return { color: 'text-zinc-400 border-zinc-500 bg-zinc-500/10', icon: Archive, label: 'Archived' };
      case 'processing': return { color: 'text-blue-400 border-blue-500 bg-blue-500/10', icon: Clock, label: 'Processing' };
      default: return { color: 'text-gray-400 border-gray-500 bg-gray-500/10', icon: Clock, label: status };
    }
  };

  const status = getStatusInfo(project.status);
  const StatusIcon = status.icon;

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const projectUrl = `https://modrinth.com/project/${project.slug}`;

  const handleOpenOnWeb = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(projectUrl, '_blank');
    setShowMenu(false);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(projectUrl);
      } else {
        // Fallback
        const tmp = document.createElement('textarea');
        tmp.value = projectUrl;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
      }
    } catch (err) {
      console.error(err);
    }
    setShowMenu(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(project.id);
  };

  useEffect(() => {
    if (!showMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showMenu]);

  return (
    <div
      ref={menuRef}
      onClick={() => onClick(project.id)}
      className="bg-modrinth-card/75 backdrop-blur-xl rounded-3xl p-4 mb-4 active:scale-[0.985] transition-all duration-300 cursor-pointer shadow-[0_10px_28px_rgba(0,0,0,0.28)] hover:shadow-[0_14px_36px_rgba(0,0,0,0.34)] group relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className="w-14 h-14 rounded-2xl bg-modrinth-bg overflow-hidden flex-shrink-0">
          {project.icon_url ? (
            <img src={project.icon_url} alt={project.title} className="w-full h-full object-cover object-center scale-[1.02]" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-modrinth-card to-modrinth-bg text-modrinth-muted font-bold text-xl">
              {project.title.charAt(0).toUpperCase()}
            </div>
          )}
          </div>
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="font-bold text-modrinth-text text-lg leading-tight truncate group-hover:text-modrinth-green transition-colors">
              {project.title}
            </h3>
            <p className="text-xs text-modrinth-muted truncate mt-0.5 font-mono opacity-70">
              {project.slug}
            </p>
          </div>
        </div>

        {showFavoriteAction && (
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`mr-2 p-2.5 rounded-full transition-all active:scale-95 ${
              isFavorite
                ? 'text-orange-400'
                : 'text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10'
            }`}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={18} strokeWidth={2.6} className={isFavorite ? 'fill-current' : ''} />
          </button>
        )}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${status.color}`}>
          <StatusIcon size={10} />
          {status.label}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="ml-2 p-2.5 rounded-full text-zinc-300 hover:text-modrinth-green hover:bg-modrinth-bg/60 transition-colors"
        >
          <MoreVertical size={20} strokeWidth={2.75} />
        </button>
      </div>

      <p className="text-sm text-modrinth-text/80 line-clamp-2 mb-4 leading-relaxed min-h-[2.5em] relative z-10">
        {summary}
      </p>

      {showMenu && (
        <div
          className="absolute top-10 right-4 z-30 rounded-2xl text-xs overflow-hidden animate-fade-in-up min-w-[180px] bg-modrinth-card shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleOpenOnWeb}
            className="relative w-full px-3 py-2 flex items-center gap-2 text-modrinth-text hover:bg-modrinth-bg text-left"
          >
            <ExternalLink size={14} className="text-modrinth-green" />
            <span>Open on Modrinth</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="relative w-full px-3 py-2 flex items-center gap-2 text-modrinth-text hover:bg-modrinth-bg text-left border-t border-modrinth-border/20"
          >
            <Copy size={14} className="text-modrinth-green" />
            <span>Copy link</span>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-modrinth-muted border-t border-zinc-700/60 pt-3 relative z-10">
        <div className="flex gap-5">
          <div className="flex items-center gap-1.5 group/stat">
            <Download size={14} className="text-zinc-500 group-hover/stat:text-modrinth-green transition-colors" />
            <span className="font-medium group-hover/stat:text-modrinth-text transition-colors">{project.downloads.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 group/stat">
            <Heart size={14} className="text-zinc-500 group-hover/stat:text-modrinth-green transition-colors" />
            <span className="font-medium group-hover/stat:text-modrinth-text transition-colors">{project.followers.toLocaleString()}</span>
          </div>
        </div>
        <ChevronRight size={16} className="text-zinc-600 group-hover:text-modrinth-green transition-all transform group-hover:translate-x-1" />
      </div>
    </div>
  );
};

export default React.memo(ProjectCard);
