import { useState, useEffect } from 'react'
import './ImageCarousel.css'

function ImageCarousel({ media, title }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [isPaused, setIsPaused] = useState(false)

  if (!media || media.length === 0) {
    return null
  }

  const minSwipeDistance = 50

  const nextImage = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length)
  }

  const prevImage = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + media.length) % media.length)
  }

  const goToImage = (index) => {
    setCurrentIndex(index)
  }

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      nextImage()
    }
    if (isRightSwipe) {
      prevImage()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (media.length <= 1) return
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prevIndex) => (prevIndex - 1 + media.length) % media.length)
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [media.length])

  // Auto-advance slides every 5 seconds (paused on hover/interaction)
  useEffect(() => {
    if (media.length > 1 && !isPaused) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [currentIndex, media.length, isPaused])

  return (
    <div 
      className="image-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div 
        className="carousel-container"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {media.map((item, index) => (
          <div
            key={index}
            className={`carousel-slide ${index === currentIndex ? 'active' : ''}`}
          >
            {item.media_type === 'image' ? (
              <img 
                src={item.file} 
                alt={`${title} ${index + 1}`}
                loading={index === currentIndex ? 'eager' : 'lazy'}
              />
            ) : (
              <video 
                controls 
                src={item.file}
                preload={index === currentIndex ? 'auto' : 'none'}
              />
            )}
          </div>
        ))}

        {media.length > 1 && (
          <>
            <button 
              className="carousel-button carousel-button-prev"
              onClick={prevImage}
              aria-label="Previous image"
            >
              ‹
            </button>
            <button 
              className="carousel-button carousel-button-next"
              onClick={nextImage}
              aria-label="Next image"
            >
              ›
            </button>

            <div className="carousel-indicators">
              {media.map((_, index) => (
                <button
                  key={index}
                  className={`indicator ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => goToImage(index)}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>

            <div className="carousel-counter">
              {currentIndex + 1} / {media.length}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ImageCarousel

