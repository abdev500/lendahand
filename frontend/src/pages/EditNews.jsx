import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api/axios'
import RichTextEditor from '../components/RichTextEditor'
import MediaUploader from '../components/MediaUploader'
import './CreateCampaign.css'

function EditNews() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    published: false,
  })
  const [mediaFiles, setMediaFiles] = useState([])
  const [existingMedia, setExistingMedia] = useState([])

  useEffect(() => {
    checkAuth()
    fetchNews()
  }, [id])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    try {
      const response = await api.get('/users/me/')
      // Only moderators and staff can edit news
      if (!response.data.is_moderator && !response.data.is_staff) {
        navigate('/news')
        return
      }
    } catch (error) {
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const fetchNews = async () => {
    try {
      const response = await api.get(`/news/${id}/`)
      setFormData({
        title: response.data.title,
        content: response.data.content,
        published: response.data.published,
      })
      setExistingMedia(response.data.media || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching news:', error)
      navigate('/news')
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value,
    })
  }

  const handleContentChange = (value) => {
    setFormData({
      ...formData,
      content: value,
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('content', formData.content)
      formDataToSend.append('published', formData.published)

      if (mediaFiles.length > 0) {
        mediaFiles.forEach((file) => {
          formDataToSend.append(`media_files`, file)
        })
      }

      await api.patch(`/news/${id}/`, formDataToSend)

      // Redirect to dashboard with success message
      navigate('/dashboard?news_updated=true')
    } catch (err) {
      console.error('Error updating news:', err)
      let errorMessage = t('news.editError', 'Failed to update news. Please try again.')
      
      if (err.response?.data) {
        const data = err.response.data
        if (typeof data === 'string') {
          errorMessage = data
        } else if (typeof data === 'object') {
          const errors = Object.values(data).flat()
          errorMessage = errors.length > 0 ? errors.join(', ') : errorMessage
        }
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="container">{t('common.loading')}</div>
  }

  return (
    <div className="create-campaign">
      <div className="container">
        <h1>{t('news.edit', 'Edit News')}</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="campaign-form">
          <div className="form-group">
            <label htmlFor="title">{t('news.title')} *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder={t('news.title')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">{t('news.content', 'Content')} *</label>
            <RichTextEditor
              value={formData.content}
              onChange={handleContentChange}
              placeholder={t('news.content', 'Write your news content here...')}
            />
          </div>

          <div className="form-group">
            <label>Media Files (Images/Videos) - Up to 6 files total</label>
            <MediaUploader
              existingMedia={existingMedia}
              selectedFiles={mediaFiles}
              onFilesChange={setMediaFiles}
              maxFiles={6}
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="published"
                checked={formData.published}
                onChange={handleChange}
              />
              {t('news.published', 'Published')}
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving} className="btn-submit">
              {saving ? t('news.saving', 'Saving...') : t('news.save', 'Save Changes')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/news')}
              className="btn-cancel"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditNews

