export const propertyProfile = {
  displayName: "Rechel's Place CDO",
  shortName: "Rechel's Place",
  descriptor: "Entire condo in Cagayan de Oro, Philippines",
  tagline: "Your home away from home in CDO awaits.",
  locationLabel: "Cagayan de Oro, Philippines",
  address: "1229 Avida Aspira Tower 1, Cagayan de Oro, Philippines 9000",
  timezone: "Asia/Manila",
  currency: "PHP",
  defaultLanguage: "en",
  phoneDisplay: "(043) 109 8599",
  phoneHref: "+63431098599",
  email: "rechel1977@hotmail.com",
  facebookUrl: "https://www.facebook.com/profile.php?id=61573549143343",
  messengerUrl: "https://m.me/61573549143343",
  airbnbUrl: "https://www.airbnb.com/rooms/641471953080650447",
  ratingLabel: "4.95 / 5",
  reviewCount: 75,
  maxGuests: 6,
  bedLabel: "5 beds",
  bathroomLabel: "2.5 baths",
  wifiLabel: "31 Mbps Wi-Fi",
  floorLabel: "12th floor",
  hostName: "Rechel",
  hostResponseLabel: "100% response rate · within an hour",
  bookingConfigured: false,
} as const;

export const galleryImages = [
  { src: "/images/rechel-s-place/airbnb-bedroom-1.jpg", alt: "Primary bedroom with a queen bed and city view" },
  { src: "/images/rechel-s-place/airbnb-living-room.jpg", alt: "Living room with sofa, 65-inch TV, and city view" },
  { src: "/images/rechel-s-place/airbnb-bedroom-2.jpg", alt: "Second bedroom with a queen bed, desk, and city view" },
  { src: "/images/rechel-s-place/airbnb-kitchen-dining.jpg", alt: "Open-plan kitchen, dining, and living area" },
  { src: "/images/rechel-s-place/airbnb-kitchen.jpg", alt: "Fully equipped guest kitchen" },
] as const;

export const galleryVideo = {
  src: "/images/rechel-s-place/rechel-place-tour.mp4",
  poster: "/images/rechel-s-place/airbnb-living-room.jpg",
  alt: "Video walkthrough of Rechel's Place entire condo",
} as const;

export const galleryLinks = [
  { href: propertyProfile.airbnbUrl, label: "View more photos on Airbnb" },
  { href: propertyProfile.facebookUrl, label: "See updates on Facebook" },
] as const;

export const amenityHighlights = [
  ["2", "Bedrooms"],
  ["6", "Guests maximum"],
  ["31", "Mbps Wi-Fi"],
  ["4.95/5", "Airbnb rating"],
] as const;

export const stayHighlights = [
  {
    title: "A true home base",
    copy: "Stay in a private two-bedroom condo in Cagayan de Oro, with city, bay, and surrounding-hills views from the 12th floor.",
  },
  {
    title: "Cook, connect, unwind",
    copy: "Use the open-plan kitchen and dining area, work online with 31 Mbps Wi-Fi, and settle in with two TVs.",
  },
  {
    title: "Walkable and well connected",
    copy: "Coffee shops, food, malls, the Pelaez sporting complex, and the on-site gym are close by, with Amaya within a half-hour drive.",
  },
] as const;

export const amenityGroups = [
  {
    title: "Sleeping arrangements",
    icon: "bed",
    items: [
      { name: "Primary bedroom", detail: "1 queen bed" },
      { name: "Second bedroom", detail: "1 queen bed, 1 sofa bed, 1 bunk bed, and 2 floor mattresses" },
      { name: "2 bedrooms · 5 beds", detail: "Comfortable sleeping space for up to 6 guests" },
    ],
  },
  {
    title: "Entertainment",
    icon: "tv",
    items: [{ name: "2 TVs" }, { name: "65-inch HDTV with Netflix" }],
  },
  {
    title: "Internet and office",
    icon: "wifi",
    items: [{ name: "Wi-Fi", detail: "31 Mbps connection" }, { name: "Dedicated workspace" }],
  },
  {
    title: "Kitchen and dining",
    icon: "kitchen",
    items: [
      { name: "Fully equipped kitchen", detail: "Space where guests can cook their own meals" },
      { name: "Open-plan dining and family space" },
      { name: "Complimentary welcome treats", detail: "Fresh fruits, chocolates, biscuits, dried mangoes, and other goodies" },
    ],
  },
  {
    title: "Building and location",
    icon: "pin",
    items: [
      { name: "Shared pool", detail: "Available year-round during building hours" },
      { name: "Free street parking" },
      { name: "Elevator access" },
      { name: "Bay and city skyline views" },
    ],
  },
  {
    title: "Services",
    icon: "lock",
    items: [{ name: "Self check-in", detail: "Keypad entry" }],
  },
  {
    title: "Home safety",
    icon: "check",
    items: [{ name: "Smoke alarm" }],
  },
] as const;

export const unavailableAmenities = ["Carbon monoxide alarm"] as const;

export const buildingAmenities = [
  "Avida Aspira Tower 1",
  "Shared pool and on-site gym",
  "Elevator access",
  "12th-floor city and bay views",
] as const;

export const houseRules = [
  "Check-in after 2:00 PM",
  "Checkout before 11:00 AM",
  "Maximum of 6 guests",
  "Pets are not allowed",
] as const;

export const checkoutRules = [
  "Follow the host's checkout instructions",
  "Secure the condo before leaving",
  "Return access items as instructed",
] as const;

export const stayDetails = {
  checkIn: "2:00 PM",
  checkOut: "11:00 AM",
  reminders: [
    "Self check-in is available with a keypad.",
    "Ask Rechel for current arrival instructions and building access details before your stay.",
  ],
} as const;

export const serviceContacts = [
  { label: "Host", name: "Rechel", phone: propertyProfile.phoneHref },
] as const;

export const nearbyPlaces = [
  "Coffee shops, food, and malls within walking distance",
  "Pelaez sporting complex, track, basketball, tennis, and an on-site gym nearby",
  "Amaya is within a half-hour drive",
] as const;
