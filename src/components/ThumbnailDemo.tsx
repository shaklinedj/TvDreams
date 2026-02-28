import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Image as ImageIcon, Monitor } from 'lucide-react';

// Demo component to showcase thumbnail adaptation changes
export default function ThumbnailDemo() {
  // Sample thumbnail data - using available uploads
  const sampleThumbnails = [
    {
      id: 1,
      name: 'Portrait Image',
      thumbnail: '/uploads/0JG31aw.jpg',
      type: 'image/jpeg',
      orientation: 'portrait'
    },
    {
      id: 2, 
      name: 'Landscape Image',
      thumbnail: '/uploads/V7iMAQV.jpg',
      type: 'image/jpeg',
      orientation: 'landscape'
    },
    {
      id: 3,
      name: 'Square Thumbnail',
      thumbnail: '/uploads/XMEEmyd_thumb.jpg',
      type: 'image/jpeg',
      orientation: 'square'
    }
  ];

  // OLD METHOD - Fixed aspect ratio (problematic)
  const renderOldThumbnail = (item: typeof sampleThumbnails[0]) => {
    const containerStyle = item.orientation === 'portrait' 
      ? { minHeight: '64px', maxHeight: '96px', aspectRatio: '9/16' }
      : { minHeight: '48px', maxHeight: '72px', aspectRatio: '16/9' };

    return (
      <div className="w-full relative group rounded-lg overflow-hidden border bg-white shadow-sm" style={containerStyle}>
        <img
          src={item.thumbnail}
          alt={item.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white p-1">
          <div className="text-xs font-medium truncate">{item.name}</div>
        </div>
        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1 py-0.5 rounded">
          🖼️
        </div>
      </div>
    );
  };

  // NEW METHOD - Clean image presentation (improved)
  const renderNewThumbnail = (item: typeof sampleThumbnails[0]) => {
    return (
      <div className="w-full relative group rounded-lg overflow-hidden">
        <img
          src={item.thumbnail}
          alt={item.name}
          className="w-full h-auto object-contain max-h-48"
          style={{ display: 'block' }}
        />
        {/* Keep only a subtle name overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs font-medium truncate">{item.name}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Thumbnail Adaptation Demo</h1>
        <p className="text-gray-600">Comparison between fixed aspect ratio vs adaptive thumbnails</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* OLD METHOD */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">❌ Before: Fixed Aspect Ratio</h2>
            <p className="text-sm text-gray-600">Thumbnails are forced to fit card dimensions</p>
          </div>
          
          <div className="grid gap-3">
            {sampleThumbnails.map(item => (
              <Card key={`old-${item.id}`} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Screen {item.id}
                  </CardTitle>
                  <CardDescription className="text-xs">Demo Location</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium">Vista Previa:</span>
                    {renderOldThumbnail(item)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* NEW METHOD */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-green-600">✅ Current: Clean Image Presentation</h2>
            <p className="text-sm text-gray-600">Clean thumbnails without frame or icons, respecting original image</p>
          </div>
          
          <div className="grid gap-3">
            {sampleThumbnails.map(item => (
              <Card key={`new-${item.id}`} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Screen {item.id}
                  </CardTitle>
                  <CardDescription className="text-xs">Demo Location</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium">Vista Previa:</span>
                    {renderNewThumbnail(item)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Key Improvements:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Aspect Ratio Preservation:</strong> Thumbnails maintain their natural proportions</li>
          <li>• <strong>Card Adaptation:</strong> Cards adjust their height to fit the thumbnail, not vice versa</li>
          <li>• <strong>Better Visual Quality:</strong> No distortion or cropping of important content</li>
          <li>• <strong>Orientation Awareness:</strong> Clear indicators for portrait vs landscape content</li>
        </ul>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="font-semibold text-green-800 mb-2">Final Implementation:</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• <strong>Clean Presentation:</strong> Images display without frame, borders, or overlay icons</li>
          <li>• <strong>Respect Original:</strong> Images maintain their natural aspect ratio and appearance</li>
          <li>• <strong>Carousel Support:</strong> Multiple images can be navigated when available</li>
          <li>• <strong>Aspect Ratio Preservation:</strong> Thumbnails maintain their natural proportions</li>
          <li>• <strong>User-Friendly:</strong> Provides immediate visual feedback about assigned content</li>
        </ul>
      </div>
    </div>
  );
}