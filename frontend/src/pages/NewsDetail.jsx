import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import ImageCarousel from '../components/ImageCarousel'
import './NewsDetail.css'

function NewsDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews()
  }, [id])

  const fetchNews = async () => {
    try {
      const response = await api.get(`/news/${id}/`)
      setNews(response.data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching news:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
  }

  if (!news) {
    return <div className="container">{t('news.notFound', 'News article not found.')}</div>
  }

  return (
    <div className="news-detail">
      <div className="container">
        <article className="news-article">
          <h1>{news.title}</h1>
          <p className="news-date">
            {new Date(news.created_at).toLocaleDateString()}
          </p>
          {news.media && news.media.length > 0 && (
            <div className="news-image">
              <ImageCarousel media={news.media} title={news.title} />
            </div>
          )}
          {(!news.media || news.media.length === 0) && news.image && (
            <div className="news-image">
              <img src={news.image} alt={news.title} />
            </div>
          )}
          <div className="news-content" dangerouslySetInnerHTML={{ __html: news.content }} />
        </article>
      </div>
    </div>
  )
}

export default NewsDetail

