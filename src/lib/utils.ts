import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isWeekend(date: Date, type: string = 'second_saturday_sundays') {
  const day = date.getDay();
  const dateNum = date.getDate();
  
  // Sunday is always a weekend
  if (day === 0) return true;
  
  if (type === 'second_saturday_sundays') {
    // Second Saturday only (Day 8 to 14 of the month)
    return day === 6 && dateNum > 7 && dateNum <= 14;
  }
  
  if (type === 'all_saturdays_sundays') {
    return day === 6 || day === 0;
  }

  if (type === 'only_sundays') {
    return day === 0;
  }
  
  return false;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}
