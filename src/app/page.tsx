"use client";
import WebSocketComponent from "./components/WebSocketComponent";
import { useState } from "react";

export default function Home() {
  // State to track which radio button is selected
  const [selectedSource, setSelectedSource] = useState("copy");

  // State for filter input values
  const [filterValues, setFilterValues] = useState({
    marketCapMin: "",
    marketCapMax: "",
    search: "",
    createdWithinMinutes: "",
    replyCount: "",
    tierFilter: "",
    maximumAllowedDrop: "",
  });

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedSource(event.target.value);
  };

  // Handler for input changes
  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFilterValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div>
      <div className="Home_headerContainer__u615e">
        <div className="Home_faviconContainer__ORPHK">
          <img
            alt="Favicon"
            loading="lazy"
            width="40"
            height="40"
            decoding="async"
            data-nimg="1"
            className="Home_favicon__TOr7d"
            style={{ color: "transparent" }}
            src="/image.webp"
          />
        </div>
        <div>
          <h1 className="Home_title__hYX6j">pumpgg terminal</h1>
          <div className="Home_twitterContainer__HhuH4">
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 512 512"
              className="Home_twitterIcon__CAY6s"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"></path>
            </svg>
            <a
              href="https://twitter.com/pumpgg"
              className="Home_twitterLink__J7GiD"
            >
              Follow us on Twitter
            </a>
          </div>
        </div>
      </div>
      <div className="Home_filtersAndButtonsContainer__OripR">
        <div className="Home_filterSection__eFa76">
          <div className="Filters_filters__HwdsO">
            <div className="Filters_filterGroup__mWIeo">
              <label className="Filters_filterLabel__1N92A">
                <input type="checkbox" />
                <span className="Filters_filterCheckbox__sMQVM"></span>
                Has Telegram
              </label>
              <label className="Filters_filterLabel__1N92A">
                <input type="checkbox" />
                <span className="Filters_filterCheckbox__sMQVM"></span>
                Has Website
              </label>
              <label className="Filters_filterLabel__1N92A">
                <input type="checkbox" />
                <span className="Filters_filterCheckbox__sMQVM"></span>
                Has Twitter
              </label>
            </div>
            <div className="Filters_filterGroup__mWIeo">
              <label className="Filters_filterLabel__1N92A">
                Market Cap Min:
                <input
                  type="number"
                  min="0"
                  name="marketCapMin"
                  className="Filters_filterInput__1_Epd"
                  value={filterValues.marketCapMin}
                  onChange={handleInputChange}
                />
              </label>
              <label className="Filters_filterLabel__1N92A">
                Market Cap Max:
                <input
                  type="number"
                  min="0"
                  name="marketCapMax"
                  className="Filters_filterInput__1_Epd"
                  value={filterValues.marketCapMax}
                  onChange={handleInputChange}
                />
              </label>
            </div>
            <div className="Filters_filterGroup__mWIeo">
              <label className="Filters_filterLabel__1N92A">
                Search:
                <input
                  type="text"
                  name="search"
                  className="Filters_filterInput__1_Epd"
                  value={filterValues.search}
                  onChange={handleInputChange}
                />
              </label>
              <label className="Filters_filterLabel__1N92A">
                Created within (minutes):
                <input
                  type="number"
                  min="0"
                  name="createdWithinMinutes"
                  className="Filters_filterInput__1_Epd"
                  value={filterValues.createdWithinMinutes}
                  onChange={handleInputChange}
                />
              </label>
              <label className="Filters_filterLabel__1N92A">
                Max Allowed Drop:
                <input
                  type="number"
                  min="0"
                  name="maximumAllowedDrop"
                  className="Filters_filterInput__1_Epd"
                  value={filterValues.maximumAllowedDrop}
                  onChange={handleInputChange}
                />
              </label>
            </div>
            <div className="Filters_filterGroup__mWIeo">
              <label className="Filters_filterLabel__1N92A">
                Trader Tier Filter:
                <select
                  name="tierFilter"
                  className="Filters_filterInput__1_Epd"
                  value={filterValues.tierFilter}
                  onChange={handleInputChange}
                >
                  <option value="">All Tiers</option>
                  <option value="1">Tier 1</option>
                  <option value="2">Tier 2</option>
                  <option value="3">Tier 3</option>
                  <option value="4">Tier 4</option>
                  <option value="5">Tier 5</option>
                  <option value="6">Tier 6</option>
                  <option value="7">Tier 7</option>
                  <option value="8">Tier 8</option>
                </select>
              </label>
            </div>
          </div>
          <div className="Home_redirectSelectorWrapper__Dg9jT">
            <div className="RedirectSelector_redirectSelector__4q__d">
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "copy"}
                  onChange={handleRadioChange}
                  value="copy"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                Copy CA
              </label>
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "pumpFun"}
                  onChange={handleRadioChange}
                  value="pumpFun"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                Pump.fun
              </label>
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "axiom"}
                  onChange={handleRadioChange}
                  value="axiom"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                Axiom
              </label>
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "trojan"}
                  onChange={handleRadioChange}
                  value="trojan"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                Trojan
              </label>
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "photon"}
                  onChange={handleRadioChange}
                  value="photon"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                Photon
              </label>
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "bullX"}
                  onChange={handleRadioChange}
                  value="bullX"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                BullX
              </label>
              <label className="RedirectSelector_redirectLabel__1LUKP">
                <input
                  type="radio"
                  checked={selectedSource === "pepeBoost"}
                  onChange={handleRadioChange}
                  value="pepeBoost"
                  name="tokenSource"
                />
                <span className="RedirectSelector_redirectRadio__xsMGC"></span>
                PepeBoost
              </label>
            </div>
          </div>
        </div>
        <div className="Home_buttonSection__9uB29">
          <button className="Home_button__G93Ef Home_playing__sQGJ7">
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 448 512"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div>
        <div>
          <WebSocketComponent selectedSource={selectedSource} />
        </div>
        <div></div>
      </div>
    </div>
  );
}
