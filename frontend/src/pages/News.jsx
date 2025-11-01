import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import ImageCarousel from '../components/ImageCarousel'
import './News.css'

function News() {
  const { t } = useTranslation()
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews()
  }, [])

  const fetchNews = async () => {
    try {
      const response = await api.get('/news/')
      setNews(response.data.results || response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching news:', error)
      setLoading(false)
    }
  }

  return (
    <div className="news-page">
      <div className="container">
        <h1>{t('news.title')}</h1>
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : news.length > 0 ? (
          <div className="news-list">
            {news.map((item) => (
              <article key={item.id} className="news-item">
                {item.media && item.media.length > 0 && (
                  <div className="news-image">
                    <ImageCarousel media={item.media} title={item.title} />
                  </div>
                )}
                {!item.media || item.media.length === 0 ? item.image && (
                  <div className="news-image">
                    <img src={item.image} alt={item.title} />
                  </div>
                ) : null}
                <div className="news-content">
                  <h2>{item.title}</h2>
                  <p className="news-date">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="news-text" dangerouslySetInnerHTML={{ __html: item.content }} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>{t('news.noNews', 'No news available.')}</p>
        )}
      </div>
    </div>
  )
}

export default News

