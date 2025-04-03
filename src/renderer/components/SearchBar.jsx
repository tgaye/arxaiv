import React, { useState } from 'react';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';

const SearchBar = ({ onSubmit, placeholder = "Enter arxiv URL..." }) => {
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query);
    }
  };

  return (
    <div className={`search-bar-container ${isActive ? 'active' : ''}`}>
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <IconSearch size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsActive(true)}
            onBlur={() => setIsActive(false)}
          />
        </div>
        <button type="submit" className="search-button" aria-label="Search">
          <IconArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};

export default SearchBar;