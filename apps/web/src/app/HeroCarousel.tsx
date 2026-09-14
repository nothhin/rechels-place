"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import UiIcon from "./UiIcon";

type HeroSlide = {
  src: string;
  alt: string;
  label: string;
  title: string;
};

type HeroCarouselProps = {
  slides: readonly HeroSlide[];
};

export default function HeroCarousel({ slides }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || isPaused || isHovering || isFocused || prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % slides.length);
    }, 6200);

    return () => window.clearInterval(timer);
  }, [isFocused, isHovering, isPaused, prefersReducedMotion, slides.length]);

  if (slides.length === 0) return null;

  const activeSlide = slides[currentIndex] ?? slides[0];
  const slideCountLabel = `${String(currentIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;

  const goToSlide = (index: number) => {
    setCurrentIndex((index + slides.length) % slides.length);
  };

  return (
    <div
      className="pwa-hero-visual pwa-hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Rechel’s Place property photos"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
    >
      <div className="pwa-hero-carousel-stage">
        {slides.map((slide, index) => (
          <div
            className={`pwa-hero-carousel-slide${index === currentIndex ? " is-active" : ""}`}
            key={slide.src}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
            aria-hidden={index !== currentIndex}
          >
            <Image
              src={slide.src}
              alt={index === currentIndex ? slide.alt : ""}
              fill
              priority={index === 0}
              quality={90}
              sizes="(max-width: 760px) 100vw, 62vw"
            />
          </div>
        ))}
      </div>

      <div className="pwa-hero-visual-top">
        <span>{slideCountLabel}</span>
        <span>Real listing photos</span>
      </div>

      <div className="pwa-hero-visual-caption" aria-live={isPaused ? "polite" : "off"}>
        <small>{activeSlide.label}</small>
        <strong>{activeSlide.title}</strong>
      </div>

      {slides.length > 1 ? (
        <div className="pwa-hero-carousel-controls" aria-label="Property photo controls">
          <button type="button" className="pwa-carousel-arrow" onClick={() => goToSlide(currentIndex - 1)} aria-label="Show previous property photo">
            <UiIcon name="arrow-right" size={16} className="pwa-carousel-arrow-icon pwa-carousel-arrow-prev" />
          </button>
          <div className="pwa-carousel-dots" role="tablist" aria-label="Choose a property photo">
            {slides.map((slide, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Show photo ${index + 1}: ${slide.label.toLowerCase()}`}
                className={`pwa-carousel-dot${index === currentIndex ? " is-active" : ""}`}
                key={slide.src}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
          <button type="button" className="pwa-carousel-pause" onClick={() => setIsPaused((paused) => !paused)} disabled={prefersReducedMotion} aria-pressed={isPaused} aria-label={prefersReducedMotion ? "Automatic photo rotation is disabled because reduced motion is enabled" : isPaused ? "Resume automatic photo rotation" : "Pause automatic photo rotation"}>
            {prefersReducedMotion ? "Motion off" : isPaused ? <><UiIcon name="play" size={13} />Resume</> : "Pause"}
          </button>
          <button type="button" className="pwa-carousel-arrow" onClick={() => goToSlide(currentIndex + 1)} aria-label="Show next property photo">
            <UiIcon name="arrow-right" size={16} />
          </button>
        </div>
      ) : null}

      <span className="sr-only" aria-live={isPaused ? "polite" : "off"}>{`Photo ${currentIndex + 1} of ${slides.length}: ${activeSlide.alt}`}</span>
    </div>
  );
}
