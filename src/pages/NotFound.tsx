import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import Lottie from 'lottie-react';

export default function NotFoundPage() {
  const [animationData, setAnimationData] = useState(null);
  const [showFallback, setShowFallback] = useState(true);

  useEffect(() => {
    // Load the 404 animation
    fetch('/error-404-animation.json')
      .then(response => response.json())
      .then(data => {
        setAnimationData(data);
        setShowFallback(false);
      })
      .catch(error => {
    // console.log('Animation could not be loaded, using fallback:', error);
        setShowFallback(true);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6 text-center relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <div className="space-y-8 max-w-lg z-10 relative">
        {/* Main 404 Animation */}
        <div className="relative">
          {!showFallback && animationData ? (
            <div className="w-80 h-60 mx-auto mb-4">
              <Lottie
                animationData={animationData}
                loop={true}
                autoplay={true}
                className="w-full h-full"
              />
            </div>
          ) : (
            /* Fallback animated 404 */
            <div className="flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-9xl font-bold bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 bg-clip-text text-transparent animate-bounce">
                  404
                </h1>
                <div className="flex justify-center space-x-2 mt-4">
                  {['4', '0', '4'].map((digit, index) => (
                    <div
                      key={index}
                      className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl shadow-lg transform hover:scale-110 transition-transform"
                      style={{
                        animationDelay: `${index * 0.2}s`,
                        animation: 'pulse 2s infinite'
                      }}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-white animate-fade-in">
            ¡Página No Encontrada!
          </h2>
          <p className="text-xl text-gray-300 animate-fade-in-delay">
            La página que buscas se perdió en el casino digital
          </p>
          <div className="flex items-center justify-center space-x-4 text-6xl animate-bounce">
            <span>🎰</span>
            <span>🎲</span>
            <span>🃏</span>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            asChild
            className="bg-gradient-to-r from-yellow-400 to-red-500 hover:from-yellow-500 hover:to-red-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            <a href="/">🏠 Volver al Inicio</a>
          </Button>
        </div>
      </div>

      {/* Additional casino-themed decorations */}
      <div className="absolute bottom-10 left-10 text-4xl animate-spin-slow">
        🎰
      </div>
      <div className="absolute top-10 right-10 text-4xl animate-bounce">
        💎
      </div>
      <div className="absolute bottom-10 right-10 text-4xl animate-pulse">
        🍀
      </div>
    </div>
  );
}
