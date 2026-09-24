import React from 'react';
import Seo from '../components/Seo.jsx';
import {GalleryContent} from '../components/MediaGallery.jsx';
import {PageHero} from './OtherPages.jsx';
import {ContactBanner} from '../components/shared.jsx';
export default function MediaGalleryPage(){return <><Seo title="Our work — Super Graphic Dubai" description="Explore Super Graphic’s signage, hoardings, building signs and installation gallery."/><PageHero label="Our work" title={<>Made real.<br/><span>Made to be seen.</span></>} description="Explore our signs, spaces, and structures. Select an image for a closer look."/><section className="container-x gallery-section"><GalleryContent/></section><ContactBanner/></>}

