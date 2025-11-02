import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './CampaignCard.css'

function CampaignCard({ campaign }) {
  const { t } = useTranslation()

  return (
    <div className="campaign-card">
      {campaign.media && campaign.media.length > 0 && (
        <Link to={`/campaign/${campaign.id}`} className="campaign-image-link">
          <div className="campaign-image">
            <img
              src={campaign.media[0].file}
              alt={campaign.title}
            />
          </div>
        </Link>
      )}
      <div className="campaign-content">
        <Link to={`/campaign/${campaign.id}`} className="campaign-title-link">
          <h3>{campaign.title}</h3>
        </Link>
        <p className="campaign-short">{campaign.short_description}</p>
        <div className="campaign-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${campaign.progress_percentage || 0}%` }}
            />
          </div>
          <div className="progress-stats">
            <span className="progress-raised">€{(campaign.current_amount || 0).toLocaleString()}</span>
            <span className="progress-target">of €{(campaign.target_amount || 0).toLocaleString()}</span>
            <span className="progress-percentage">{campaign.progress_percentage || 0}%</span>
          </div>
        </div>
        <Link to={`/campaign/${campaign.id}`} className="campaign-link">
          {t('campaign.donate')}
        </Link>
      </div>
    </div>
  )
}

export default CampaignCard
