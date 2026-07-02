import { useState, useMemo } from "react";
import { 
  Search, CheckCircle2, Image as ImageIcon,
  AlertTriangle, ImageOff, ArrowDownToLine,
  SlidersHorizontal, LayoutGrid, Download, Filter
} from "lucide-react";
import { useExtractImages } from "@workspace/api-client-react";
import type { ExtractResult, ImageItem } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [url, setUrl] = useState("");
  const [extractionResult, setExtractionResult] = useState<ExtractResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const extractImages = useExtractImages();

  const handleScan = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const targetUrl = typeof e === 'string' ? e : url;
    if (!targetUrl) return;
    
    try {
      new URL(targetUrl);
    } catch {
      setExtractionError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    setUrl(targetUrl);
    setIsExtracting(true);
    setExtractionError(null);
    setExtractionResult(null);
    
    try {
      const result = await extractImages.mutateAsync({ data: { url: targetUrl } });
      setExtractionResult(result);
    } catch (err: any) {
      setExtractionError(err?.message || "Failed to extract images");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-24">
      {/* Header / Input Area */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border p-4 md:py-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 text-primary font-black text-2xl tracking-tighter uppercase">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md shadow-sm">
              <Search className="w-5 h-5" strokeWidth={3} />
            </div>
            GRABBER
          </div>
          
          <form onSubmit={handleScan} className="flex w-full md:max-w-2xl gap-2">
            <Input 
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="flex-1 bg-card shadow-sm border-border text-foreground font-mono text-sm h-12 px-4 focus-visible:ring-primary"
              disabled={isExtracting}
            />
            <Button 
              type="submit" 
              disabled={isExtracting || !url}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md tracking-wide"
            >
              {isExtracting ? "SCANNING..." : "SCAN"}
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {extractionError && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Extraction Failed</AlertTitle>
            <AlertDescription>{extractionError}</AlertDescription>
          </Alert>
        )}

        {isExtracting ? (
          <div className="py-24 text-center max-w-lg mx-auto animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              <Search className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">Analyzing Surface Area...</h2>
            <p className="text-muted-foreground mb-12">Booting headless browser, scrolling viewport, and parsing DOM tree. This can take 10–30 seconds for heavy sites.</p>
            
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 opacity-30">
              {Array.from({ length: 18 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-sm" style={{ animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        ) : extractionResult ? (
          <ResultsPanel result={extractionResult} />
        ) : (
          <div className="py-24 lg:py-32 text-center max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-2xl mb-4 shadow-inner ring-1 ring-primary/20">
              <LayoutGrid className="w-12 h-12 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-foreground leading-tight">
              Scrape every pixel.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A precision tool for extracting visual assets. We render the page, scroll to trigger lazy loading, and pull every image, background, and meta tag directly from the DOM.
            </p>
            
            <div className="pt-12 border-t border-border/50">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Test targets</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" className="border-primary/20 hover:border-primary hover:bg-primary/5" onClick={() => handleScan("https://apple.com")}>Apple.com</Button>
                <Button variant="outline" className="border-primary/20 hover:border-primary hover:bg-primary/5" onClick={() => handleScan("https://stripe.com")}>Stripe.com</Button>
                <Button variant="outline" className="border-primary/20 hover:border-primary hover:bg-primary/5" onClick={() => handleScan("https://en.wikipedia.org/wiki/Photography")}>Wikipedia</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultsPanel({ result }: { result: ExtractResult }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

  // Filters
  const [filterSources, setFilterSources] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['loaded']);
  const [minWidth, setMinWidth] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("area-desc");

  const availableSources = useMemo(() => Array.from(new Set(result.images.map(img => img.source))), [result.images]);
  const availableStatuses = useMemo(() => Array.from(new Set(result.images.map(img => img.status))), [result.images]);

  const filteredImages = useMemo(() => {
    let imgs = result.images.filter(img => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!img.url.toLowerCase().includes(q) && !(img.alt || "").toLowerCase().includes(q)) return false;
      }
      // Source
      if (filterSources.length > 0 && !filterSources.includes(img.source)) return false;
      // Status
      if (filterStatuses.length > 0 && !filterStatuses.includes(img.status)) return false;
      // Min Width
      const actualWidth = Math.max(img.renderedWidth || 0, img.naturalWidth || 0);
      if (minWidth > 0 && actualWidth > 0 && actualWidth < minWidth) return false;
      
      return true;
    });

    // Sort
    imgs.sort((a, b) => {
      if (sortBy === 'size-desc') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      if (sortBy === 'area-desc') {
        const areaA = Math.max(a.renderedWidth * a.renderedHeight, a.naturalWidth * a.naturalHeight) || 0;
        const areaB = Math.max(b.renderedWidth * b.renderedHeight, b.naturalWidth * b.naturalHeight) || 0;
        return areaB - areaA;
      }
      if (sortBy === 'source') return a.source.localeCompare(b.source);
      return 0;
    });

    return imgs;
  }, [result.images, searchQuery, filterSources, filterStatuses, minWidth, sortBy]);

  // Synchronize selection to only keep items that are still in the filtered list
  useMemo(() => {
    const filteredIds = new Set(filteredImages.map(img => img.id));
    let changed = false;
    const newSelected = new Set<string>();
    selectedIds.forEach(id => {
      if (filteredIds.has(id)) newSelected.add(id);
      else changed = true;
    });
    // Can't set state directly in useMemo, but we can clear stale selection when selecting all etc.
  }, [filteredImages]);


  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredImages.map(img => img.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDownload = async (urls: string[]) => {
    if (!urls.length) return;
    setIsDownloading(true);
    try {
      const hostname = new URL(result.finalUrl).hostname;
      const filename = `images-${hostname}-${Date.now()}.zip`;
      
      const res = await fetch(`${import.meta.env.BASE_URL}api/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, filename })
      });
      
      if (!res.ok) throw new Error("Failed to generate zip");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      alert("Download failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-5 flex flex-col items-center justify-center text-center bg-card shadow-sm border-border">
          <span className="text-3xl font-black text-foreground">{result.totalImages}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Total Assets</span>
        </Card>
        <Card className="p-5 flex flex-col items-center justify-center text-center bg-card shadow-sm border-border">
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-500">{result.loadedCount}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Valid Links</span>
        </Card>
        <Card className="p-5 flex flex-col items-center justify-center text-center bg-card shadow-sm border-border">
          <span className="text-3xl font-black text-destructive">{result.brokenCount}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Broken</span>
        </Card>
        <Card className="p-5 flex flex-col items-center justify-center text-center bg-card shadow-sm border-border">
          <span className="text-3xl font-black text-foreground">{(result.durationMs / 1000).toFixed(1)}s</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Scan Time</span>
        </Card>
        <Card className="p-5 flex flex-col items-center justify-center text-center bg-card shadow-sm border-border">
          <span className="text-xl font-bold text-foreground font-mono mt-1">{result.renderer}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Engine</span>
        </Card>
      </div>

      <div className="flex items-center gap-3 bg-card p-3 px-4 rounded-lg text-sm border border-border shadow-sm">
        <div className="font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-[4px] text-[11px] tracking-wider uppercase">Target</div>
        <a href={result.finalUrl} target="_blank" rel="noreferrer" className="truncate font-mono hover:text-primary transition-colors hover:underline underline-offset-4 decoration-primary/30">
          {result.finalUrl}
        </a>
      </div>

      {result.warnings.length > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-4 w-4 stroke-2" />
          <AlertTitle className="font-bold">Scan Warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 text-sm mt-2 space-y-1">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Advanced Toolbar */}
      <div className="sticky top-[80px] md:top-[96px] z-30 bg-background/95 backdrop-blur-md py-4 border-b border-border shadow-sm -mx-4 px-4 md:mx-0 md:px-0 flex flex-col gap-4">
        
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Input 
            placeholder="Search URL or alt..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full md:w-64 bg-card font-mono text-sm"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {(filterSources.length > 0 || filterStatuses.length !== 1 || minWidth > 0) && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 min-w-[20px] h-5 flex items-center justify-center bg-primary text-primary-foreground">!</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-5 space-y-6" align="start">
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Source Type</Label>
                <div className="flex flex-wrap gap-2">
                  {availableSources.map(src => (
                    <Badge 
                      key={src} 
                      variant={filterSources.includes(src) ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => setFilterSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src])}
                    >
                      {src}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {availableStatuses.map(status => (
                    <Badge 
                      key={status} 
                      variant={filterStatuses.includes(status) ? "default" : "outline"}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => setFilterStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])}
                    >
                      {status}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Min Width</Label>
                  <span className="text-xs font-mono">{minWidth}px</span>
                </div>
                <Slider 
                  min={0} max={2000} step={50}
                  value={[minWidth]}
                  onValueChange={([v]) => setMinWidth(v)}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterSources([]);
                  setFilterStatuses(['loaded']);
                  setMinWidth(0);
                }}>Reset Filters</Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] bg-card">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area-desc">Largest Area</SelectItem>
              <SelectItem value="size-desc">Largest File Size</SelectItem>
              <SelectItem value="source">Source Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Selection & Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 p-2 rounded-lg border border-border">
          <div className="flex items-center gap-3 pl-2">
            <div className="text-sm font-medium">
              <span className="text-primary font-bold text-base">{selectedIds.size}</span> 
              <span className="text-muted-foreground"> / {filteredImages.length} visible selected</span>
            </div>
            <div className="w-px h-4 bg-border/80 mx-1"></div>
            <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-8">Select All</Button>
            <Button variant="ghost" size="sm" onClick={handleClearSelection} disabled={selectedIds.size === 0} className="h-8">Clear</Button>
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm"
              onClick={() => handleBulkDownload(filteredImages.filter(img => selectedIds.has(img.id)).map(i => i.url))}
              disabled={selectedIds.size === 0 || isDownloading}
              className="font-bold gap-2"
            >
              {isDownloading ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"></div>
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isDownloading ? "ZIPPING..." : "DOWNLOAD SELECTED"}
            </Button>
            <Button 
              size="sm"
              variant="secondary"
              onClick={() => handleBulkDownload(filteredImages.map(i => i.url))}
              disabled={filteredImages.length === 0 || isDownloading}
              className="font-bold gap-2"
            >
              <Download className="w-4 h-4" />
              DOWNLOAD ALL VISIBLE
            </Button>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredImages.map((img, idx) => {
          const isSelected = selectedIds.has(img.id);
          const proxyUrl = `${import.meta.env.BASE_URL}api/proxy?url=${encodeURIComponent(img.url)}`;
          const w = Math.max(img.renderedWidth || 0, img.naturalWidth || 0);
          const h = Math.max(img.renderedHeight || 0, img.naturalHeight || 0);
          
          return (
            <Card 
              key={img.id} 
              className={`group relative overflow-hidden flex flex-col cursor-pointer transition-all duration-200 border-2 shadow-sm
                ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md scale-[0.98]' : 'border-border hover:border-primary/50 hover:shadow-md'}
              `}
              style={{ animationDelay: `${(idx % 20) * 15}ms` }}
              onClick={() => setSelectedImage(img)}
            >
              <div 
                className="absolute top-2 left-2 z-10 p-1.5 cursor-pointer"
                onClick={e => { e.stopPropagation(); toggleSelection(img.id); }}
              >
                <div className={`w-5 h-5 rounded-sm border-[1.5px] flex items-center justify-center transition-colors shadow-sm
                  ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background/90 border-muted-foreground/50 group-hover:border-primary/70 backdrop-blur-md'}`}>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />}
                </div>
              </div>

              <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden p-2">
                {img.status === "broken" ? (
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <ImageOff className="w-8 h-8 opacity-40" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Broken Link</span>
                  </div>
                ) : (
                  <img 
                    src={proxyUrl} 
                    alt={img.alt || "Extracted image"} 
                    loading="lazy"
                    className={`max-w-full max-h-full object-contain transition-transform duration-500 ease-out group-hover:scale-105 ${isSelected ? 'opacity-90' : ''}`}
                  />
                )}
              </div>
              
              <div className="p-2 border-t border-border bg-card flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider bg-secondary/50 text-secondary-foreground border-transparent">
                    {img.extension || "img"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground" title={`${w}x${h}`}>
                    {w > 0 ? `${w}×${h}` : '---'}
                  </span>
                </div>
                <div className="truncate text-[10px] text-muted-foreground/70" title={img.url}>
                  {new URL(img.url, "http://dummy").pathname.split('/').pop() || img.source}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredImages.length === 0 && (
        <div className="py-32 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
            <Filter className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold mb-2">No matches found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or search query to see more results.
          </p>
          {(filterSources.length > 0 || filterStatuses.length !== 1 || minWidth > 0 || searchQuery) && (
            <Button variant="outline" className="mt-6" onClick={() => {
              setFilterSources([]);
              setFilterStatuses(['loaded']);
              setMinWidth(0);
              setSearchQuery("");
            }}>
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-5xl bg-background border-border shadow-2xl p-0 overflow-hidden sm:rounded-xl">
          {selectedImage && (
            <div className="flex flex-col md:flex-row h-[85vh] md:h-[75vh]">
              <div className="flex-1 bg-[#0f1115] flex items-center justify-center p-6 border-r border-border relative group">
                {selectedImage.status === 'broken' ? (
                  <ImageOff className="w-16 h-16 text-white/20" />
                ) : (
                  <img 
                    src={`${import.meta.env.BASE_URL}api/proxy?url=${encodeURIComponent(selectedImage.url)}`}
                    alt={selectedImage.alt}
                    className="max-w-full max-h-full object-contain drop-shadow-2xl"
                  />
                )}
              </div>
              <div className="w-full md:w-96 bg-card flex flex-col overflow-y-auto">
                <div className="p-6 border-b border-border bg-muted/10">
                  <DialogTitle className="text-sm font-black uppercase tracking-widest text-primary mb-1">Asset Inspector</DialogTitle>
                  <p className="text-xs text-muted-foreground font-mono truncate">{new URL(selectedImage.url, "http://dummy").pathname.split('/').pop() || 'image'}</p>
                </div>
                
                <div className="p-6 space-y-6 flex-1 text-sm">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Source Vector</span>
                    <div className="font-mono bg-muted/50 p-2 rounded text-foreground border border-border/50">
                      {selectedImage.source}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Dimensions</span>
                      <div className="font-mono text-foreground">
                        {Math.max(selectedImage.renderedWidth, selectedImage.naturalWidth) > 0 
                          ? `${Math.max(selectedImage.renderedWidth, selectedImage.naturalWidth)} × ${Math.max(selectedImage.renderedHeight, selectedImage.naturalHeight)}`
                          : 'Unknown'}
                      </div>
                    </div>
                    {selectedImage.sizeBytes > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">File Size</span>
                        <div className="font-mono text-foreground">{(selectedImage.sizeBytes / 1024).toFixed(1)} KB</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Alt Text</span>
                    <div className="text-foreground border border-border/50 p-3 rounded bg-card min-h-[60px] break-words leading-snug">
                      {selectedImage.alt || <span className="opacity-40 italic">No alternative text provided</span>}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Target URL</span>
                    <div className="font-mono text-[11px] break-all bg-muted/50 p-3 rounded border border-border/50 text-foreground">
                      {selectedImage.url}
                    </div>
                  </div>
                </div>
                
                <div className="p-6 border-t border-border bg-muted/10">
                  <a 
                    href={`${import.meta.env.BASE_URL}api/proxy?url=${encodeURIComponent(selectedImage.url)}&download=1`}
                    download={`image-${selectedImage.id}.${selectedImage.extension || 'jpg'}`}
                    className="block"
                  >
                    <Button className="w-full font-bold tracking-wide h-12 shadow-sm gap-2" size="lg">
                      <ArrowDownToLine className="w-5 h-5" />
                      DOWNLOAD ASSET
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}