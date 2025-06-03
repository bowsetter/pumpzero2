"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { FaTelegram, FaTwitter, FaGlobeAmericas, FaCog } from "react-icons/fa";
import { TokenData, FilterValues } from "@/types/tokens";
import SettingsModal from "./SettingsModal";

interface WebSocketComponentProps {
  selectedSource?: string;
}

// Interface for tokens with animation state
interface AnimatedTokenData extends TokenData {
  animationState?: "entering" | "exiting" | "stable";
  animationId?: string; // Unique ID for animation tracking
}

function WebSocketComponent({
  selectedSource = "copy",
}: WebSocketComponentProps) {
  // State to store token data with animation states
  const [tokenList, setTokenList] = useState<AnimatedTokenData[]>([]);
  // Track the newest token for special animation
  const [newestTokenMint, setNewestTokenMint] = useState<string | null>(null);
  // State for tokens that are exiting (being filtered out)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [exitingTokens, setExitingTokens] = useState<AnimatedTokenData[]>([]);

  // Hover and pause state management
  const [isHovered, setIsHovered] = useState(false);
  const [wasAlreadyPaused, setWasAlreadyPaused] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // References to track state across renders
  const isPausedRef = useRef(isPaused);
  const isHoveredRef = useRef(isHovered);

  // State for tracking filter values
  const [filterValues, setFilterValues] = useState<FilterValues>({
    hasTelegram: false,
    hasWebsite: false,
    hasTwitter: false,
    isKingOfTheHill: false,
    marketCapMin: "",
    marketCapMax: "",
    search: "",
    createdWithinMinutes: "",
    replyCount: "",
    tierFilter: "",
    maxAllowedDrop: "",
  });

  // State for Solana price
  const [solanaPrice, setSolanaPrice] = useState<number>(0);
  // State for tracking last price update
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  // Refs
  const pausedTokensRef = useRef<TokenData[]>([]);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);
  const animationTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  // State for settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Keep refs in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  // Helper function to generate a unique animation ID
  const generateAnimationId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  useEffect(() => {
    // Run your function here whenever filterValues change
    fetchTokens();
  }, [filterValues]);

  // Helper function to get filter values from the DOM
  const getFilterValues = (): FilterValues => {
    const newFilterValues = { ...filterValues };

    // Get checkbox values - using text content comparison
    const checkboxes = document.querySelectorAll(
      '.Filters_filterLabel__1N92A input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      const label = input.closest(".Filters_filterLabel__1N92A");
      if (!label) return;

      const labelText = label.textContent?.trim() || "";
      if (labelText.includes("Has Telegram"))
        newFilterValues.hasTelegram = input.checked;
      if (labelText.includes("Has Website"))
        newFilterValues.hasWebsite = input.checked;
      if (labelText.includes("Has Twitter"))
        newFilterValues.hasTwitter = input.checked;
    });

    // Get number/text input values
    const inputs = document.querySelectorAll(
      '.Filters_filterLabel__1N92A input[type="number"], .Filters_filterLabel__1N92A input[type="text"]'
    );

    const selects = document.querySelectorAll(
      ".Filters_filterLabel__1N92A select"
    );
    selects.forEach((select) => {
      const selectElement = select as HTMLSelectElement;
      const label = selectElement.closest(".Filters_filterLabel__1N92A");
      if (!label) return;

      const labelText = label.textContent?.trim() || "";
      if (labelText.includes("Trader Tier"))
        newFilterValues.tierFilter = selectElement.value;
    });

    inputs.forEach((input) => {
      const inputElement = input as HTMLInputElement;
      const label = inputElement.closest(".Filters_filterLabel__1N92A");
      if (!label) return;

      const labelText = label.textContent?.trim() || "";
      if (labelText.includes("Market Cap Min"))
        newFilterValues.marketCapMin = inputElement.value;
      if (labelText.includes("Market Cap Max"))
        newFilterValues.marketCapMax = inputElement.value;
      if (labelText.includes("Search"))
        newFilterValues.search = inputElement.value;
      if (labelText.includes("Created within"))
        newFilterValues.createdWithinMinutes = inputElement.value;
      if (labelText.includes("Reply Count"))
        newFilterValues.replyCount = inputElement.value;
      if (labelText.includes("Max Allowed Drop"))
        newFilterValues.maxAllowedDrop = inputElement.value;
    });

    return newFilterValues;
  };

  // Fetch token data from API
  const fetchTokens = async () => {
    // Prevent multiple concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    // Prevent excessive fetching (no more than once per second)
    const now = Date.now();

    try {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;

      const currentFilters = getFilterValues();

      const params = new URLSearchParams();
      params.append("source", selectedSource);
      if (currentFilters.hasTelegram) params.append("hasTelegram", "true");
      if (currentFilters.hasWebsite) params.append("hasWebsite", "true");
      if (currentFilters.hasTwitter) params.append("hasTwitter", "true");
      if (currentFilters.isKingOfTheHill)
        params.append("isKingOfTheHill", "true");
      if (currentFilters.marketCapMin)
        params.append("marketCapMin", currentFilters.marketCapMin);
      if (currentFilters.marketCapMax)
        params.append("marketCapMax", currentFilters.marketCapMax);
      if (currentFilters.maxAllowedDrop)
        params.append("maxalloweddrop", currentFilters.maxAllowedDrop);
      if (currentFilters.search) params.append("search", currentFilters.search);
      if (currentFilters.createdWithinMinutes)
        params.append(
          "createdWithinMinutes",
          currentFilters.createdWithinMinutes
        );
      if (currentFilters.replyCount)
        params.append("replyCount", currentFilters.replyCount);
      if (currentFilters.tierFilter)
        params.append("tierFilter", currentFilters.tierFilter);

      const response = await fetch(`/api/tokens?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const fetchedTokens = data.tokens || [];

      // Check effective pause state - paused by button OR by hover
      const effectivelyPaused = isPausedRef.current || isHoveredRef.current;

      // Use the effective pause state
      if (!effectivelyPaused) {
        // Compare current tokens with new tokens to determine which ones need to exit
        if (tokenList.length > 0) {
          const currentTokenMints = new Set(tokenList.map((t) => t.mint));
          const newTokenMints = new Set(
            fetchedTokens.map((t: TokenData) => t.mint)
          );

          // Find tokens that will be removed (in current list but not in new list)
          const tokensToRemove = tokenList.filter(
            (token) => !newTokenMints.has(token.mint)
          );

          if (tokensToRemove.length > 0) {
            // Mark these tokens as exiting
            const exiting = tokensToRemove.map((token) => ({
              ...token,
              animationState: "exiting" as const,
              animationId: token.animationId || generateAnimationId(),
            }));

            // Add to exiting tokens
            setExitingTokens((prev) => [...prev, ...exiting]);

            // Remove exiting tokens after animation completes
            const timeout = setTimeout(() => {
              setExitingTokens((prev) =>
                prev.filter(
                  (t) => !tokensToRemove.some((rt) => rt.mint === t.mint)
                )
              );
            }, 500); // Match the animation duration

            animationTimeoutsRef.current.push(timeout);
          }

          // Find tokens that will be added (in new list but not in current list)
          const tokensToAdd = fetchedTokens.filter(
            (t: TokenData) => !currentTokenMints.has(t.mint)
          );

          // Keep tokens that exist in both lists
          const tokensToKeep = tokenList
            .filter((token) => newTokenMints.has(token.mint))
            .map((token) => ({
              ...token,
              animationState: "stable" as const,
            }));

          // Determine what tokens to animate - MODIFIED
          let newTokenList;
          if (tokensToAdd.length > 0) {
            // Only animate the newest token (first in the array)
            // Check if we have new tokens
            if (tokensToAdd.length > 0 && tokensToAdd[0].mint) {
              // Update our newest token tracking
              setNewestTokenMint(tokensToAdd[0].mint);
            }
            // Create animated token list with only first new token having 'entering' state
            const animatedNewTokens = tokensToAdd.map(
              (token: TokenData, index: number) => ({
                ...token,
                animationState:
                  index === 0 ? ("entering" as const) : ("stable" as const),
                animationId: generateAnimationId(),
              })
            );

            newTokenList = [...tokensToKeep, ...animatedNewTokens];
          } else {
            newTokenList = tokensToKeep;
          }

          // Sort based on the order from API response
          const mintOrderMap = new Map(
            fetchedTokens.map((t: TokenData, idx: number) => [t.mint, idx])
          );
          newTokenList.sort((a, b) => {
            return (
              (Number(mintOrderMap.get(a.mint)) || 0) -
              (Number(mintOrderMap.get(b.mint)) || 0)
            );
          });

          setTokenList(newTokenList);
        } else {
          // If no tokens currently exist, just set the new ones with ONLY the first one having entering animation
          const animatedTokens = fetchedTokens.map(
            (token: TokenData, index: number) => ({
              ...token,
              animationState:
                index === 0 ? ("entering" as const) : ("stable" as const),
              animationId: generateAnimationId(),
            })
          );

          setTokenList(animatedTokens);
        }
      } else {
        // When paused, store in ref
        pausedTokensRef.current = fetchedTokens;
      }

      setSolanaPrice(data.solanaPrice || 0);
      setLastPriceUpdate(
        data.lastPriceUpdate ? new Date(data.lastPriceUpdate) : null
      );
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Create a queue and processing flag outside your onmessage handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageQueue: any[] = [];
  let isProcessingQueue = false;

  // Function to process the queue
  const processQueue = () => {
    if (messageQueue.length === 0) {
      isProcessingQueue = false;
      return;
    }

    isProcessingQueue = true;
    const nextMessage = messageQueue.shift();

    // Process the message
    try {
      const data = nextMessage;

      if (data.type === "initialData") {
        // Handle initialData...
        if (
          !isPausedRef.current &&
          !isHoveredRef.current &&
          data.tokens &&
          Array.isArray(data.tokens)
        ) {
          fetchTokens();
        }
      } else if (data.type === "tokenTrade") {
        // Handle tokenTrade...
        if (!isPausedRef.current && !isHoveredRef.current) {
          fetchTokens();
        }
      }
    } catch (error) {
      console.error("Error processing queued message:", error);
    }

    // Schedule the next message processing after 1 second
    setTimeout(processQueue, 500);
  };

  // Set up WebSocket connection and initial data fetching
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Disconnect any existing websocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Determine correct WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    // Create new WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    let reconnectTimer: NodeJS.Timeout | null = null;

    ws.onopen = () => {
      fetchTokens();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Add the parsed message to the queue
        messageQueue.push(data);

        // Start processing the queue if it's not already being processed
        if (!isProcessingQueue) {
          processQueue();
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);

      // Set up reconnection timer
      if (reconnectTimer) clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          // Make sure we're not already connected
          const newWs = new WebSocket(wsUrl);
          wsRef.current = newWs;
        }
      }, 5000);
    };

    // Clean up on unmount
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clear any animation timeouts
      animationTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      animationTimeoutsRef.current = [];
    };
  }, [selectedSource]); // Reconnect when source changes

  // Set up filter change detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Function to handle changes to any filter
    const handleFilterChange = () => {
      const newFilterValues = getFilterValues();
      setFilterValues(newFilterValues);
    };

    // Get all filter inputs and attach listeners
    const filterInputs = document.querySelectorAll(
      ".Filters_filterLabel__1N92A input"
    );
    filterInputs.forEach((input) => {
      input.addEventListener("change", handleFilterChange);
      input.addEventListener("input", handleFilterChange);
    });
    // Get all select inputs and attach listeners
    const filterSelects = document.querySelectorAll(
      ".Filters_filterLabel__1N92A select"
    );
    filterSelects.forEach((select) => {
      select.addEventListener("change", handleFilterChange);
    });

    // Initial filter
    setFilterValues(getFilterValues());

    // Set up a periodic check for filter changes (as a backup)
    const filterCheckInterval = setInterval(handleFilterChange, 2000);

    // Cleanup listeners
    return () => {
      filterInputs.forEach((input) => {
        input.removeEventListener("change", handleFilterChange);
        input.removeEventListener("input", handleFilterChange);
      });
      filterSelects.forEach((select) => {
        select.removeEventListener("change", handleFilterChange);
      });
      clearInterval(filterCheckInterval);
    };
  }, []);

  // Function to update the button SVG
  const updateButtonSVG = (isPaused: boolean) => {
    const buttonElement = playButtonRef.current;
    if (!buttonElement) return;

    // Find the SVG element inside the button
    const svgElement = buttonElement.querySelector("svg");
    if (!svgElement) return;

    if (isPaused) {
      // Change to play icon (triangle pointing right)
      svgElement.innerHTML = `
      <path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"></path>
    `;
      svgElement.setAttribute("viewBox", "0 0 448 512");
    } else {
      // Change to pause icon (two vertical bars)
      svgElement.innerHTML = `
      <path d="M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"></path>
    `;
      svgElement.setAttribute("viewBox", "0 0 448 512");
    }
  };

  // Handle play/pause button
  useEffect(() => {
    if (typeof window === "undefined") return;

    const playButton = document.querySelector(".Home_button__G93Ef");
    if (!playButton) return;

    // Store the button reference
    playButtonRef.current = playButton as HTMLButtonElement;

    const handlePlayPauseClick = () => {
      setIsPaused((prevPaused) => {
        const newPausedState = !prevPaused;

        // Update the button appearance
        if (newPausedState) {
          playButton.classList.remove("Home_playing__sQGJ7");
          playButton.classList.add("Home_paused__1gk2b");
        } else {
          playButton.classList.remove("Home_paused__1gk2b");
          playButton.classList.add("Home_playing__sQGJ7");

          // Only resume data flow if not currently being hovered
          if (!isHoveredRef.current) {
            // When resuming, add any tokens received while paused
            if (pausedTokensRef.current.length > 0) {
              // Set newest token if we have paused tokens
              if (pausedTokensRef.current.length > 0) {
                setNewestTokenMint(pausedTokensRef.current[0].mint);
              }

              // MODIFIED: Only animate the first token when resuming from pause
              const animatedTokens = pausedTokensRef.current.map(
                (token, index) => ({
                  ...token,
                  animationState:
                    index === 0 ? ("entering" as const) : ("stable" as const),
                  animationId: generateAnimationId(),
                })
              );
              setTokenList(animatedTokens);
              pausedTokensRef.current = []; // Clear paused tokens

              // Reset newest token after animation completes
              const timeout = setTimeout(() => {
                setNewestTokenMint(null);
              }, 500);

              animationTimeoutsRef.current.push(timeout);
            }

            // Refresh data
            fetchTokens();
          }
        }

        // Update the SVG icon
        updateButtonSVG(newPausedState);

        return newPausedState;
      });
    };

    playButton.addEventListener("click", handlePlayPauseClick);

    // Set initial icon based on state
    updateButtonSVG(isPaused);

    return () => {
      playButton.removeEventListener("click", handlePlayPauseClick);
    };
  }, []);

  // Reset tokens when selected source changes
  useEffect(() => {
    // Clear token list when source changes
    setTokenList([]);
    setExitingTokens([]);
    pausedTokensRef.current = [];

    // Fetch tokens for the new source
    fetchTokens();
  }, [selectedSource]);

  // Format a USD market cap with commas and two decimal places
  const formatMarketCapUsd = (marketCapSol: number | undefined): string => {
    const marketCapUsd = (marketCapSol || 0) * solanaPrice;

    // Format based on size
    if (marketCapUsd >= 1000000) {
      return `${(marketCapUsd / 1000000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}M`;
    } else if (marketCapUsd >= 1000) {
      return `${(marketCapUsd / 1000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}K`;
    } else {
      return `${marketCapUsd.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  };

  // Calculate time ago
  const getTimeAgo = (timestamp: Date | string): string => {
    const now = new Date();
    const tokenTime =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const diffInMinutes = Math.floor(
      (now.getTime() - tokenTime.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 24 * 60) {
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return `${Math.floor(diffInMinutes / (60 * 24))}d`;
    }
  };

  // Function to truncate description
  const truncateText = (text: string | undefined, maxLength = 70): string => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Helper function to get source display name
  const getSourceLabel = (): string => {
    switch (selectedSource) {
      case "copy":
        return "copy";
      case "pumpFun":
        return "pump.fun";
      case "Axiom":
        return "Axiom";
      case "trojan":
        return "trojan";
      case "photon":
        return "photon";
      case "bullX":
        return "bullX";
      case "pepeBoost":
        return "pepeBoost";
      default:
        return "pump";
    }
  };

  // Get the correct trading platform URL based on selected source
  const getRedirectUrl = (token: TokenData): string | null => {
    // Get the mint address which is consistently available in your data structure
    const address = token.mint;

    if (!address) {
      return null;
    }

    switch (selectedSource) {
      case "pumpFun":
        return `https://pump.fun/coin/${address}`;
      case "axiom":
        return `http://axiom.trade/t/${address}`;
      case "trojan":
        return `https://t.me/solana_trojanbot?start=r-demigod0-${address}`;
      case "photon":
        return `https://photon-sol.tinyastro.io/en/lp/${address}`;
      case "bullX":
        return `https://bullx.io/terminal?chainId=1399811149&address=${address}`;
      case "pepeBoost":
        return `https://t.me/pepeboost_sol_bot?start=${address}`;
      default:
        return `https://pump.fun/coin/${address}`;
    }
  };

  // Handle card click for copying to clipboard
  const handleCardClick = (token: TokenData): void => {
    if (!token) {
      return;
    }

    if (selectedSource === "copy") {
      // Create token info string with important details
      const tokenInfo = {
        name: token.name || "Unknown Token",
        symbol: token.symbol || "N/A",
        mint: token.mint,
        description: token.description || "No description available",
        image: token.image || "",
        marketCapSol: token.marketCapSol || 0,
      };

      // Copy to clipboard
      navigator.clipboard
        .writeText(tokenInfo.mint)
        .then(() => {
          // Show toast notification on success
          showTokenToast(token);
        })
        .catch((error) => {
          console.error("Failed to copy token info to clipboard", error);
          // If clipboard API fails, show error toast
          showErrorToast("Failed to copy token info to clipboard");
        });
    } else {
      // Handle card click for other sources
      handleCardSelectClick(token);
    }
  };

  const handleCardSelectClick = (token: TokenData): void => {
    const redirectUrl = getRedirectUrl(token);
    if (!redirectUrl) {
      return;
    } // Open in new tab
    window.open(redirectUrl, "_blank");
  };

  const showErrorToast = (message: string): void => {
    // Create toast element
    const toast = document.createElement("div");
    toast.className = "token-toast token-toast-error";
    toast.style.backgroundColor = "#d32f2f"; // Red color for error

    // Add content
    toast.innerHTML = `
      <div class="token-toast-content">
        <div class="token-toast-title">Error</div>
        <div>${message}</div>
      </div>
    `;

    // Add to body
    document.body.appendChild(toast);

    // Remove after animation (3 seconds)
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  };

  // Function to show a toast with token details
  const showTokenToast = (token: TokenData): void => {
    // Create toast element
    const toast = document.createElement("div");
    toast.className = "token-toast";

    // Create inner HTML for toast
    let toastHTML = "";

    // Add image if available
    if (token.image) {
      toastHTML += `<img src="${token.image}" alt="${
        token.name || "Token"
      }" class="token-toast-img">`;
    }

    // Add content
    toastHTML += `
      <div class="token-toast-content">
        <div class="token-toast-title">${token.name || "Unknown Token"} ${
      token.symbol ? `(${token.symbol})` : ""
    }</div>
        <div>Token info copied to clipboard!</div>
      </div>
    `;

    toast.innerHTML = toastHTML;

    // Add to body
    document.body.appendChild(toast);

    // Remove after animation (3 seconds)
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  };

  // Define the improved mouse hover handlers
  const onMouseEnter = useCallback(() => {
    // Remember if it was already paused before hover
    setWasAlreadyPaused(isPausedRef.current);
    setIsHovered(true);

    // Only update the pause state if it wasn't already paused
    if (!isPausedRef.current) {
      // Don't update the button appearance here
      // Just set the internal hover state to pause data processing
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    setIsHovered(false);

    // Only unpause if it wasn't already paused before the hover
    if (!wasAlreadyPaused) {
      // Don't update any button appearance
      // Just allow data flow to resume if it wasn't paused before

      // Flush any tokens that accumulated during hover
      if (pausedTokensRef.current.length > 0 && !isPausedRef.current) {
        if (pausedTokensRef.current.length > 0) {
          setNewestTokenMint(pausedTokensRef.current[0].mint);
        }

        const animatedTokens = pausedTokensRef.current.map((token, index) => ({
          ...token,
          animationState:
            index === 0 ? ("entering" as const) : ("stable" as const),
          animationId: generateAnimationId(),
        }));

        setTokenList(animatedTokens);
        pausedTokensRef.current = []; // Clear paused tokens

        // Reset newest token after animation completes
        const timeout = setTimeout(() => {
          setNewestTokenMint(null);
        }, 500);

        animationTimeoutsRef.current.push(timeout);

        // Refresh data
        fetchTokens();
      }
    }
  }, [wasAlreadyPaused]);

  // Handle social link clicks without triggering card redirect
  const handleSocialClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string
  ) => {
    e.stopPropagation(); // Prevent the card click handler from firing
    window.open(url, "_blank");
  };

  // Get animation class based on animation state
  const getAnimationClass = (
    state?: "entering" | "exiting" | "stable"
  ): string => {
    switch (state) {
      case "entering":
        return "token-card-enter";
      case "exiting":
        return "token-card-exit";
      default:
        return "";
    }
  };

  // Add CSS for animations to the component
  useEffect(() => {
    // Create a style element if it doesn't exist
    let styleEl = document.getElementById("token-animations");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "token-animations";
      document.head.appendChild(styleEl);
    }

    // Define the CSS animations
    styleEl.innerHTML = `
      @keyframes slideInFromLeft {
        0% {
          transform: translateX(-100px);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes fadeOut {
        0% {
          transform: translateX(-100px);
          opacity: 0;
        }
        100% {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .token-card-enter {
        animation: slideInFromLeft 0.4s ease-out forwards;
      }
      
      .token-card-exit {
        animation: fadeOut 0.5s ease-out forwards;
      }
    `;

    // Cleanup
    return () => {
      if (styleEl && document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  // Handle settings saved
  const handleSettingsSaved = () => {
    fetchTokens(); // Refresh tokens to reflect updated tiers
  };

  // Render tokens in a grid layout that matches the parent structure and image style
  return (
    <>
      {/* Settings Button */}
      <div className="mb-4" style={{ paddingLeft: "20px" }}>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="px-4 py-1  flex justify-center items-center gap-1 bg-[#2c2c2c] text-sm text-white rounded"
        >
          Advanced Settings <FaCog />
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* Button paused indicator */}
      {isPaused && (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            padding: "12px 15px",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            borderTop: "1px solid #ff5555",
            borderBottom: "1px solid #ff5555",
            color: "#ff5555",
            marginBottom: "15px",
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "15px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "2px",
              background:
                "linear-gradient(90deg, transparent, #ff5555, transparent)",
              animation: "pausedScanline 2s linear infinite",
            }}
          />

          <img
            src="/peach-goma-crate-peach.gif"
            alt="Paused"
            style={{
              height: "60px",
              width: "60px",
              filter: "drop-shadow(0 0 3px rgba(255, 85, 85, 0.7))",
            }}
          />

          <span
            style={{
              fontWeight: "bold",
              textShadow: "0 0 5px rgba(255, 85, 85, 0.5)",
              display: "flex",
              alignItems: "center",
            }}
            className="text-sm md:text-md"
          >
            DISPLAY PAUSED — Tokens will be shown when resumed
          </span>

          <style jsx global>{`
            @keyframes pausedScanline {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(100%);
              }
            }
          `}</style>
        </div>
      )}

      {solanaPrice > 0 && (
        <div
          style={{
            width: "100%",
            textAlign: "center",
            padding: "5px",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            color: "#4ADE80",
            borderRadius: "4px",
            marginBottom: "15px",
            gridColumn: "1 / -1",
            fontSize: "14px",
          }}
        >
          Solana Price: ${solanaPrice.toFixed(2)} USD
          {lastPriceUpdate && (
            <span
              style={{ fontSize: "12px", marginLeft: "10px", color: "#9CA3AF" }}
            >
              Updated: {lastPriceUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      <div className="Home_tradeGrid__7UcjU">
        {tokenList.length > 0 ? (
          tokenList.map((token) => (
            <div
              key={`${token.mint}-${
                token.animationId || generateAnimationId()
              }`}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onClick={() => handleCardClick(token)}
              className={`Home_card__1gk2b ${getAnimationClass(
                token.animationState
              )} ${token.hasupdatedmc ? "has-updated-mc" : ""}`}
              style={{
                backgroundColor: "#1e1e1e",
                color: "white",
                borderRadius: "8px",
                padding: "12px",
                position: "relative",
                overflow: "hidden",
                width: "100%",
                cursor: "pointer",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
                // Add a highlight effect if this is the newest token
                boxShadow: token.hasupdatedmc
                  ? "1px solid rgba(0,255,0,.8)"
                  : "none",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  token.mint === newestTokenMint
                    ? "0 0 8px rgba(0,255,0,.4)"
                    : "0 4px 8px rgba(0, 0, 0, 0.2)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  token.mint === newestTokenMint
                    ? "0 0 8px rgba(0,255,0,.4)"
                    : "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {/* Origin Tag */}
                <div
                  style={{
                    top: "8px",
                    right: "8px",
                    fontSize: "12px",
                    color: "#6e6e6e",
                  }}
                >
                  Dev Sell:{" "}
                  {Number(
                    (((token.devTokensSold ?? 0) / 1000000000) * 100).toFixed(1)
                  )}
                  %
                </div>
                {/* Origin Tag */}
                <div
                  style={{
                    top: "8px",
                    right: "8px",
                    fontSize: "12px",
                    color: "#6e6e6e",
                  }}
                >
                  {token.mint && token.mint.length > 9
                    ? "..." + token.mint.substring(token.mint.length - 9)
                    : token.mint}
                </div>
              </div>

              {/* Token Name */}
              <div
                style={{
                  color: "#ffffff",
                  fontSize: "16px",
                  fontWeight: "bold",
                  marginBottom: "2px",
                  marginTop: "10px",
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {token.name || "Unknown"} ({token.symbol || "?"})
              </div>

              {/* Price and Stats */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "8px",
                  fontSize: "14px",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    color: "#4ADE80",
                    fontWeight: "bold",
                  }}
                >
                  {formatMarketCapUsd(token.marketCapSol)}
                </span>
                <span style={{ color: "#f5f5f587" }}>
                  | Age: {getTimeAgo(token.timestamp)} |
                </span>
                <span style={{ color: "#f5f5f587" }}>
                  BUY:{" "}
                  <span style={{ color: "#4ADE80b0" }}>{token.tradeBuys}</span>{" "}
                  |
                </span>
                <span style={{ color: "#f5f5f587" }}>
                  SELL:{" "}
                  <span style={{ color: "#ff0000b0" }}>{token.tradeSells}</span>{" "}
                  |
                </span>
                <span style={{ color: "#f5f5f587" }}>
                  Change:{" "}
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor:
                        (token.priceChangePercent ?? 0) >= 0
                          ? "#00ff00b0"
                          : "#ff0000b0",
                      marginRight: "4px",
                    }}
                  ></span>
                  <span
                    style={{
                      color:
                        (token.priceChangePercent ?? 0) >= 0
                          ? "#00ff00b0"
                          : "#ff0000b0",
                    }}
                  >
                    {(token.priceChangePercent ?? 0) >= 0 ? "+" : ""}
                    {token.priceChangePercent?.toFixed(2)}%
                  </span>{" "}
                  |
                </span>
              </div>

              {/* Token Logo */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                {token.image && (
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      marginRight: "12px",
                      backgroundColor: "#333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={token.image}
                      alt={token.name || "Token"}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        // Hide broken images
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Description */}
                <div
                  style={{
                    fontSize: "14px",
                    color: "#D1D5DB", // Light gray text
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {truncateText(token.description)}
                </div>
              </div>

              {/* Social links */}
              <div
                style={{
                  display: "flex",
                  gap: "1px",
                }}
              >
                {token.twitter && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 4px",
                      borderRadius: "4px",
                      fontSize: "16px",
                      color: "#939393",
                    }}
                  >
                    <a
                      href={token.twitter}
                      onClick={(e) => handleSocialClick(e, token.twitter || "")}
                      style={{ color: "inherit" }}
                      target="_blank"
                    >
                      <FaTwitter />
                    </a>
                  </div>
                )}

                {token.telegram && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 4px",
                      borderRadius: "4px",
                      fontSize: "16px",
                      color: "#a6a6a6",
                    }}
                  >
                    <a
                      href={token.telegram}
                      onClick={(e) =>
                        handleSocialClick(e, token.telegram || "")
                      }
                      style={{ color: "inherit" }}
                      target="_blank"
                    >
                      <FaTelegram />
                    </a>
                  </div>
                )}

                {token.website && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 4px",
                      borderRadius: "4px",
                      fontSize: "16px",
                      color: "#a6a6a6",
                    }}
                  >
                    <a
                      href={token.website}
                      onClick={(e) => handleSocialClick(e, token.website || "")}
                      style={{ color: "inherit" }}
                      target="_blank"
                    >
                      <FaGlobeAmericas />
                    </a>
                  </div>
                )}
              </div>
              <div className="flex gap-1 w-full mt-2">
                {[
                  {
                    count: token.traderTiers?.tier1.count ?? 0,
                    percentage: token.traderTiers?.tier1.percentage ?? 0,
                    color: "#16a34a", // Green for Tier 1
                    translucent: "rgba(22, 163, 74, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier2.count ?? 0,
                    percentage: token.traderTiers?.tier2.percentage ?? 0,
                    color: "#4ade80", // Light Green for Tier 2
                    translucent: "rgba(74, 222, 128, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier3.count ?? 0,
                    percentage: token.traderTiers?.tier3.percentage ?? 0,
                    color: "#a3e635", // Lime for Tier 3
                    translucent: "rgba(163, 230, 53, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier4.count ?? 0,
                    percentage: token.traderTiers?.tier4.percentage ?? 0,
                    color: "#facc15", // Yellow for Tier 4
                    translucent: "rgba(250, 204, 21, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier5.count ?? 0,
                    percentage: token.traderTiers?.tier5.percentage ?? 0,
                    color: "#f59e0b", // Amber for Tier 5
                    translucent: "rgba(245, 158, 11, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier6.count ?? 0,
                    percentage: token.traderTiers?.tier6.percentage ?? 0,
                    color: "#fb923c", // Orange for Tier 6
                    translucent: "rgba(251, 146, 60, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier7.count ?? 0,
                    percentage: token.traderTiers?.tier7.percentage ?? 0,
                    color: "#f87171", // Light Red for Tier 7
                    translucent: "rgba(248, 113, 113, 0.2)",
                  },
                  {
                    count: token.traderTiers?.tier8.count ?? 0,
                    percentage: token.traderTiers?.tier8.percentage ?? 0,
                    color: "#dc2626", // Red for Tier 8
                    translucent: "rgba(220, 38, 38, 0.2)",
                  },
                ].map((tier, index, arr) => {
                  const maxCount = Math.max(
                    ...arr.map((t) => t?.count ?? 0),
                    1
                  );
                  const height = tier
                    ? (tier.count / maxCount) * 100 || 20
                    : 20; // Minimum height for empty tiers
                  const bgColor =
                    tier && tier.count > 0
                      ? tier.color
                      : tier?.translucent ?? "rgba(0,0,0,0.1)";
                  const textColor =
                    tier && tier.count > 0 ? "#ffffff" : "#9ca3af";
                  const borderRadius =
                    index === 0
                      ? "rounded-l-md"
                      : index === arr.length - 1
                      ? "rounded-r-md"
                      : "";

                  return (
                    <div
                      key={index}
                      className={`flex-1 h-40 flex items-center justify-center ${borderRadius}`}
                      style={{
                        height: `${height}%`,
                        backgroundColor: bgColor,
                      }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{ color: textColor }}
                      >
                        {tier ? tier.count : 0} <span className="text-[10px]">{tier?.percentage.toFixed()}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: "#6e6e6e",
              gridColumn: "1 / -1",
            }}
          >
            <p>Waiting for tokens from {getSourceLabel()}...</p>
            <p style={{ fontSize: "14px", marginTop: "10px" }}>
              If no tokens appear within a few seconds, try refreshing the page
              or check the console for errors.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default WebSocketComponent;
