import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
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
          <p>Loading...</p>
        ) : news.length > 0 ? (
          <div className="news-list">
            {news.map((item) => (
              <article key={item.id} className="news-item">
                {item.image && (
                  <div className="news-image">
                    <img src={item.image} alt={item.title} />
                  </div>
                )}
                <div className="news-content">
                  <h2>{item.title}</h2>
                  <p className="news-date">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="news-text">{item.content}</div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>No news available.</p>
        )}
      </div>
    </div>
  )
}

export default News

